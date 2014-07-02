/**
 * service.js
 *
 * Computer Science 50
 * Problem Set 8
 *
 * Implements a shuttle service.
 */

// default height
var HEIGHT = 0.8;

// default latitude
var LATITUDE = 42.3745615030193;

// default longitude
var LONGITUDE = -71.11803936751632;

// default heading
var HEADING = 1.757197490907891;

// default number of seats
var SEATS = 10;

// default velocity
var VELOCITY = 50;

// global reference to shuttle's marker on 2D map
var bus = null;

// remember total people dropped off
var dropoffPoints = 0;

// global reference to 3D Earth
var earth = null;

// reference for "Konami code" flymode
var flymode = null;

// save passenger's house dropoff data when picked up on shuttle, so don't need to iterate again
var houseTo = []; 

// global reference to 2D map
var map = null;

// remember total people picked up
var pickupPoints = 0;

// reference to passengers' data for pickup and dropoff use
var popdata = [];

// global reference to shuttle
var shuttle = null;

// load version 1 of the Google Earth API
google.load("earth", "1");

// load version 3 of the Google Maps API
google.load("maps", "3", {other_params: "sensor=false"});

// once the window has loaded
$(window).load(function() {

    // listen for keydown anywhere in body
    $(document.body).keydown(function(event) {
        return keystroke(event, true);
    });

    // listen for keyup anywhere in body
    $(document.body).keyup(function(event) {
        return keystroke(event, false);
    });

    // listen for click on Drop Off button
    $("#dropoff").click(function(event) {
        dropoff();
    });

    // listen for click on Pick Up button
    $("#pickup").click(function(event) {
        pickup();
    });

    // load application
    load();
});

// unload application
$(window).unload(function() {
    unload();
});

/**
 * Renders seating chart.
 */
function chart()
{
    var html = "<ol start='0'>";
    for (var i = 0; i < shuttle.seats.length; i++)
    {
        if (shuttle.seats[i] == null)
        {
            html += "<li>Empty Seat</li>";
        }
        
        else
        {
            var houseRe = /\w*(?=\sHouse)/;
            var houseId = houseRe.exec(houseTo[i]);
            html += "<li id=" + houseId + ">" + shuttle.seats[i] + " -- " + houseTo[i] + "<div></div></li>";
        }
    }
    html += "</ol>";
    $("#chart").html(html);
}

/**
 * Drops up passengers if their stop is nearby.
 */
function dropoff()
{
    var housecounter = 1;
    for (houses in HOUSES)
    {   
        // no match
        if (shuttle.distance(HOUSES[houses].lat, HOUSES[houses].lng) > 30.0)
        {
            // not currently within distance of ANY houses
            (housecounter == 12) ? $("#announcements").html("Shuttle is not within 30 meters of a house.") : housecounter++;
        }
        
        // we have a match!
        else if (shuttle.distance(HOUSES[houses].lat, HOUSES[houses].lng) < 30)
        {   
            var seatcount = 0;
            var dropcount = 0;
            var currenthouse = houses;
            for (var i = 0; i < SEATS; i++)
            {
                if (shuttle.seats[i] == null)
                {
                    // no passengers at all or more seats to check
                    (seatcount == SEATS - 1) ? $("#announcements").html("There are no passengers to drop off") : seatcount++;
                }
                
                // someone in a seat
                else
                {
                    // This house is a dropoff point! Empty the seats and announce
                    if (currenthouse == houseTo[i])
                    {
                        shuttle.seats[i] = null;
                        houseTo[i] = null;
                        dropcount++;
                        dropoffPoints++;
                        // all passengers from the map have been picked up and dropped off
                        if (dropoffPoints == 100)
                        {
                            $("#announcements").html("Everyone has been picked up and has been dropped off! You win!!");
                            $("#points").html("Dropoff Points: " + dropoffPoints + "  -- You Win!!");
                        }
                        
                        else if (dropoffPoints < 100)
                        {
                            $("#announcements").html(dropcount + ((dropcount == 1) ? " person has": " people have") + " been dropped off at " + currenthouse + "."); 
                            $("#dscore").html("Dropoff Points: " + dropoffPoints);
                        }
                    }
                    
                    // This house is not current passenger's house
                    else if (currenthouse != houseTo[i])
                    {
                        $("#announcements").html("This is " + currenthouse + ". <br>None of the passengers live at this house.");
                    }
                    // refresh the chart to reflect seating changes
                    chart();
                }
            }
        }    
    }
}

/**
 * Called if Google Earth fails to load.
 */
function failureCB(errorCode) 
{
    // report error unless plugin simply isn't installed
    if (errorCode != ERR_CREATE_PLUGIN)
    {
        alert(errorCode);
    }
}

/**
 * Handler for Earth's frameend event.
 */
function frameend() 
{
    shuttle.update();
}

/**
 * Called once Google Earth has loaded.
 */
function initCB(instance) 
{
    // retain reference to GEPlugin instance
    earth = instance;

    // specify the speed at which the camera moves
    earth.getOptions().setFlyToSpeed(100);

    // show buildings
    earth.getLayerRoot().enableLayerById(earth.LAYER_BUILDINGS, true);

    // disable terrain (so that Earth is flat)
    earth.getLayerRoot().enableLayerById(earth.LAYER_TERRAIN, false);

    // prevent mouse navigation in the plugin
    earth.getOptions().setMouseNavigationEnabled(false);

    // instantiate shuttle
    shuttle = new Shuttle({
        heading: HEADING,
        height: HEIGHT,
        latitude: LATITUDE,
        longitude: LONGITUDE,
        planet: earth,
        seats: SEATS,
        velocity: VELOCITY
    });

    // synchronize camera with Earth
    google.earth.addEventListener(earth, "frameend", frameend);

    // synchronize map with Earth
    google.earth.addEventListener(earth.getView(), "viewchange", viewchange);

    // update shuttle's camera
    shuttle.updateCamera();

    // show Earth
    earth.getWindow().setVisibility(true);

    // render seating chart
    chart();

    // populate Earth with passengers and houses
    populate();
}

/**
 * Handles keystrokes.
 */
function keystroke(event, state)
{
    // ensure we have event
    if (!event)
    {
        $("#announcements").html("Shuttle is not moving.");
        event = window.event;
    }

    // left arrow
    if (event.keyCode == 37)
    {
        shuttle.states.turningLeftward = state;
        return false;
    }
    
    // G, g -- Fly Mode up
    else if ((event.keyCode == 71) && (flymode == "godmodeon" || flymode == "godmodemodeonon"))
    {
        shuttle.states.flyingUpward = state;
        return false;
    }
    
    // H, h -- Fly mode down
    else if ((event.keyCode == 72) && (flymode == "godmodeon" || flymode == "godmodemodeonon"))
    {
        shuttle.states.flyingDownward = state;
        return false;
    }

    // up arrow
    else if (event.keyCode == 38)
    {
        shuttle.states.tiltingUpward = state;
        return false;
    }

    // right arrow
    else if (event.keyCode == 39)
    {
        shuttle.states.turningRightward = state;
        return false;
    }

    // down arrow
    else if (event.keyCode == 40)
    {
        shuttle.states.tiltingDownward = state;
        return false;
    }

    // A, a
    else if (event.keyCode == 65 || event.keyCode == 97)
    {
        shuttle.states.slidingLeftward = state;
        $("#announcements").html("On we go!");
        return false;
    }

    // D, d
    else if (event.keyCode == 68 || event.keyCode == 100)
    {
        shuttle.states.slidingRightward = state;
        $("#announcements").html("On we go!");
        return false;
    }
  
    // S, s
    else if (event.keyCode == 83 || event.keyCode == 115)
    {
        shuttle.states.movingBackward = state;
        $("#announcements").html("On we go!");
        return false;
    }

    // W, w
    else if (event.keyCode == 87 || event.keyCode == 119)
    {
        shuttle.states.movingForward = state;
        $("#announcements").html("On we go!");
        return false;
    }

    // F, f
    else if (event.keyCode == 70 || event.keyCode == 102)
    {
        flymode = "god";
    }
    
    // L, l
    else if (event.keyCode == 76 || event.keyCode == 108)
    {
        flymode += "mode";
    }
    
    // Y, y
    else if (event.keyCode == 89 || event.keyCode == 121)
    {
        flymode += "on";
    }

    return true;
}

/**
 * Loads application.
 */
function load()
{
    // embed 2D map in DOM
    var latlng = new google.maps.LatLng(LATITUDE, LONGITUDE);
    map = new google.maps.Map($("#map").get(0), {
        center: latlng,
        disableDefaultUI: true,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        scrollwheel: false,
        zoom: 17,
        zoomControl: true
    });

    // prepare shuttle's icon for map
    bus = new google.maps.Marker({
        icon: "https://maps.gstatic.com/intl/en_us/mapfiles/ms/micons/bus.png",
        map: map,
        title: "you are here"
    });

    // embed 3D Earth in DOM
    google.earth.createInstance("earth", initCB, failureCB);
}

/**
 * Picks up nearby passengers.
 */
function pickup()
{
    for (var i in popdata)
    { 
        // shuttle is within 15 meters of a passenger
        if (shuttle.distance(popdata[i].buildingAt.lat, popdata[i].buildingAt.lng) <= 15)
        {
            var counter = 1;
            var freshman = false;
            
            // check to see if this is a freshman that can't be picked up
            for (house in HOUSES)
            {            
                console.log(popdata[i].buildingTo);
                console.log(counter);
                console.log(house);
                
                // if this person's house matches a house from HOUSES, it must not be a freshman
                if (popdata[i].buildingTo == house)
                {
                    break; 
                }
                
                // Must be a freshman and if the number of HOUSES in houses.js ever changes it will need updating
                else if (popdata[i].buildingTo != house && counter == 12)
                {
                    freshman = true; 
                }
                
                // still iterating through HOUSES
                else if (popdata[i].buildingTo != house && counter < 12)
                {
                    counter++;
                }
            }
            
            if (freshman == true)
            {
                $("#announcements").html("Can't pick up " + popdata[i].name + "." + "<br>This person is a freshman!");
                break;
            }
                        
            // check for open seats
            for (var j in shuttle.seats)
            {
                // keeps person from appearing multiple times if pickup button clicked multiple times when picking them up                
                if (shuttle.seats[j] === popdata[i].name)
                {
                    $("#announcements").html(popdata[i].name + " is already on the shuttle!");
                    break;
                }
                
                else if (shuttle.seats[j] == null)
                {
                    shuttle.seats[j] = popdata[i].name;
                    houseTo[j] = popdata[i].buildingTo;
                    chart(popdata[i].name);
                    pickupPoints++;
                    $("#announcements").html(popdata[i].name + " is on the shuttle!");
                    $("#pscore").html("Pickup Points: " + pickupPoints);
                    
                    // remove placemark
                    var features = earth.getFeatures();
                    features.removeChild(popdata[i].popPlacemark);
                    
                    // remove marker
                    popdata[i].popMarker.setMap(null);
                    break;
                }
                
                else if (shuttle.seats[j] != null && j == shuttle.seats.length - 1)
                {
                    $("#announcements").html("No seats are available. Try later.");
                    break;
                }
            }
            break;
        }
        
        if (shuttle.distance(popdata[i].buildingAt.lat, popdata[i].buildingAt.lng) > 15)
        {
            $("#announcements").html("Nobody is close enough to pick up.");
        }
    }
}

/**
 * Populates Earth with passengers and houses.
 */
function populate()
{
    // mark houses
    for (var house in HOUSES)
    {
        // plant house on map
        new google.maps.Marker({
            icon: "https://google-maps-icons.googlecode.com/files/home.png",
            map: map,
            position: new google.maps.LatLng(HOUSES[house].lat, HOUSES[house].lng),
            title: house
        });
    }

    // get current URL, sans any filename
    var url = window.location.href.substring(0, (window.location.href.lastIndexOf("/")) + 1);
    
    // scatter passengers
    for (var i = 0; i < PASSENGERS.length; i++)
    {
        // pick a random building
        var building = BUILDINGS[Math.floor(Math.random() * BUILDINGS.length)];

        // prepare placemark
        var placemark = earth.createPlacemark("");
        placemark.setName(PASSENGERS[i].name + " to " + PASSENGERS[i].house);

        // prepare icon
        var icon = earth.createIcon("");
        icon.setHref(url + "/img/" + PASSENGERS[i].username + ".jpg");

        // prepare style
        var style = earth.createStyle("");
        style.getIconStyle().setIcon(icon);
        style.getIconStyle().setScale(4.0);

        // prepare stylemap
        var styleMap = earth.createStyleMap("");
        styleMap.setNormalStyle(style);
        styleMap.setHighlightStyle(style);

        // associate stylemap with placemark
        placemark.setStyleSelector(styleMap);

        // prepare point
        var point = earth.createPoint("");
        point.setAltitudeMode(earth.ALTITUDE_RELATIVE_TO_GROUND);
        point.setLatitude(building.lat);
        point.setLongitude(building.lng);
        point.setAltitude(0.0);

        // associate placemark with point
        placemark.setGeometry(point);

        // add placemark to Earth
        earth.getFeatures().appendChild(placemark);

        // add marker to map
        var marker = new google.maps.Marker({
            icon: "https://maps.gstatic.com/intl/en_us/mapfiles/ms/micons/man.png",
            map: map,
            position: new google.maps.LatLng(building.lat, building.lng),
            title: PASSENGERS[i].name + " at " + building.name
        });
        
        popdata[i] = 
        {
            name: PASSENGERS[i].name,
            buildingAt: building,
            buildingTo: PASSENGERS[i].house,
            popPlacemark: placemark,
            popMarker: marker
        }
    }
}

/**
 * Handler for Earth's viewchange event.
 */
function viewchange() 
{
    // keep map centered on shuttle's marker
    var latlng = new google.maps.LatLng(shuttle.position.latitude, shuttle.position.longitude);
    map.setCenter(latlng);
    bus.setPosition(latlng);
}

/**
 * Unloads Earth.
 */
function unload()
{
    google.earth.removeEventListener(earth.getView(), "viewchange", viewchange);
    google.earth.removeEventListener(earth, "frameend", frameend);
}
