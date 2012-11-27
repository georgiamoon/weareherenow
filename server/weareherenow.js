/*********************************************************

  We Are Here Now Project (c) 2012 SIDL & Bryan Valentini 

 ********************************************************/

(function(clientIdsFile) {

    var _ = require('underscore');
    var async = require('async');
    var csv  = require('csv');
    var mysql = require('mysql');
    var request = require('request');
    var util = require('util');
    
    var settings = require('./config.js');
    var nystateplane = require('./nystateplane');

    // global data structure - be careful
    var fsqCategories;
    var reverseFsqCategories;
    
    const FSQ_RATE_LIMIT = 'x-ratelimit-remaining';
    const FSQ_RADIUS = 170;
    const END_DELAY_MS = 60 * 1000; // prevent spinning on failure
    const LOW_REMAINING_SLEEP_MS = 5 * 60 * 1000;
    const THROTTLE_MS = 500;
    const API_VERSION = 'v=20120727';

    /** Make the DB connection first and foremost. **/

    if (!process.argv[2]) {
        console.error('Client IDs file not specified.');
        return;
    }

    console.log('Attempt to establish DB connection:', settings.host);

    var connection = mysql.createConnection(settings);
    
    if (!connection) {
        console.error('No DB connection.');
        return;
    }
    
    connection.on('error', function() {
        console.warn('DB Connection failure, restarting process.')
        process.exit(1);
    });

    connection.connect(function(err, result) {
        if (!err) {
            Main();
        } else {
            console.error('DB connection failed!', err);       
        }
    }); 

        
    /** MAIN - process dependent tasks in waterfall model **/
    function Main() {

        console.log('%s Starting Main()', new Date().toISOString());
        async.waterfall(            

            // controls order methods are called
            [loadClients, loadCentroids, loadCategories, search], 
            
            // output
            function(err, results) { 
                console.log(new Date().toISOString(), 'Shutting down. error:', err, 'results:', results);
                connection.end();
                
                console.log('Sleeping for', END_DELAY_MS, 'ms');
                _.delay(function(){ console.log('Done.'); }, END_DELAY_MS);
            }
        );
    }


    /** Load foursquare client configuration objects  **/
    function loadClients(cb) {
        var clients = [];

        // load client ids from disk
        // format: client id, client secret
        var clientIdsReader = csv().fromPath(clientIdsFile);

        clientIdsReader.on('error', function(error) {
            cb && cb(error);
        });

        clientIdsReader.on('data', function (data) { 
            clients.push(toClient(data[0], data[1])); 
        });

        clientIdsReader.on('end', function() { 
            console.log('Clients loaded:', clients.length);
            cb && cb(null, clients);  //next
        });
    }

    var toClient = function(clientid, clientsecret) { 
        return {id: clientid, secret: clientsecret, remaining: 1};
    };

    /**  Load all the search points **/
    function loadCentroids(clients, cb) {
        var centroids = [];

        // small file, read the whole thing into memory
        var fileReader = csv().fromPath('./centroids.csv');
        
        // data and error read events
        fileReader.on('error', function(error) { 
            console.error('Error reading local centroids file.', error);  
            cb && cb(error);
        });

        fileReader.on('data', function(centroid) { 
            centroids.push(centroid); 
        });
        
        // upon finishing, call callback with new data
        fileReader.on('end', function() { 
            console.log('Centroids loaded:', centroids.length);
            cb && cb(null, clients, centroids); //next
        });
    }


    /** Fetch venue categories from foursquare **/
    function loadCategories(clients, centroids, cb) {
      
        fetchCategories(clients[0], function(error, results) {
            if (error) {
                cb && cb(error);
            } else if (results.categories.length == 0) {
                cb && cb('Error: no categories returned');
            } else {
                console.log('Search... building category lookup map. ', results.categories.length, 'top level categories.');
                
                // cache categories once this session
                fsqCategories = results.categories;
                reverseFsqCategories = reverseMapping(results.categories);

                cb && cb(null, clients, centroids);
            }
        });
    }

    function fetchCategories(client, cb) {

        var endpoint = buildVenueCategoriesEndpoint(client);
        
        callEndpoint(endpoint, client, true, function (error, results) { 
            if (results && results.success) {
                results['categories'] = (results.body.response.categories || []);
                cb && cb(null, results);     
            } else {
                cb && cb(error, null);
            } 
        }); 
    }

    function buildVenueCategoriesEndpoint(client) {
      return '/v2/venues/categories?' 
        + 'client_id=' + client.id + '&' 
        + 'client_secret=' + client.secret + '&'
        + 'limit=50&'  
        + API_VERSION; 
    }

    /** 
     *  Categories data structure from 4SQ is a tree, where the root nodes are the most general categories.
     *  Return a reverse mapping of all the sub-nodes to top-most category.
     */
    function reverseMapping(categoryRoots) {
        var map = {};

        categoryRoots.forEach(function (topLevelCategory) {
            var subs = [];
            var leftToExplore = [].concat(topLevelCategory.categories);
             
            while (leftToExplore.length !== 0) {
                var t = leftToExplore.pop();
                subs.push(t);

                if (t.categories && t.categories.length > 0) {
                    //console.log("Node:", t.name, "=>", _.pluck(t.categories, "name"), leftToExplore.length);
                    leftToExplore = leftToExplore.concat(t.categories);
                }
            }

            subs.forEach(function (subc) {
                map[ subc.id ] = {'id': topLevelCategory.id, 'name': topLevelCategory.name, 'subname': subc.name}; 
            });

            map[ topLevelCategory.id ] = {'id': topLevelCategory.id, 'name': topLevelCategory.name, 'subname': 'self' }; 
              
        });

        return map;
    }


    /** 
     *  Venue crawler
     *  Create a queue of venue search tasks that are run in parallel, but limited to run
     *  only the same # of tasks at a times as client IDs loaded. 
     *  Furthermore, throttle the number of overall # requests a second to prevent 
     *  this process from hitting the 4sq servers or the DB too hard.
     */
    function search(clients, centroids, cb) {    
        console.log('Search...creating tasks');
        var tasks = _.zip(centroids, cycle(clients, centroids.length));

        console.log('Search...throttling crawler');  
        var worker = _.throttle(searchOnce, THROTTLE_MS);
        
        console.log('Search...spawn parallel workers');
        async.forEachLimit(tasks, clients.length, worker, searchComplete(cb));   
        
        console.log('Search...startup is complete, crawling venues...');
        console.log();
    }

    // runs once per latlng request
    function searchOnce(task, cb) {
        var client = task[1];
        var centroid = task[0];        
        fetchVenues(client, centroid, FSQ_RADIUS, searchResult(cb));
    }
    
    // runs once per foursquare response, must call taskCallback to allow other requests to go forward
    function searchResult(taskCallback) {
        return function(error, results) {
           
             console.log(new Date().toISOString(), results.centroid, results.remaining, results.client);
            
            if (results && results.success) {
           
                insertDb(results.venues, function() {               
                    if (results && results.remaining < 5) {
                        taskCallback && _.delay(taskCallback, LOW_REMAINING_SLEEP_MS);
                    } else {
                        taskCallback && taskCallback();
                    }
                });

            } else {
                console.warn(new Date().toISOString(), 'possible error:', error, results);
                taskCallback && taskCallback(); 
            }
        }
    }
    
    // runs at the very end of all requests
    function searchComplete(cb) {
        return function(error) {
            if (error) {
                cb && cb(error);  // pass on the error to top level
            } else {
                console.log('\n! Search complete ! \n');
                cb && cb();
            }
        }; 
    }

    /** 
     *  Fetching Venues 
     *  @param cb - callback that expects error, results
     */
    function fetchVenues(client, centroid, radius, cb) {
        var endpoint = buildVenuesSearchEndpoint(client, centroid, radius);
     
        callEndpoint(endpoint, client, false, function(error, results) {
            if (results && results.success) {  
                var fsqData = results.body.response.venues || [];          
                var venues  = fsqData.map(function (v) { return new Venue(v); });
                results['centroid'] = centroid;  
                results['venues'] = venues;    
                cb && cb(null, results);
            } else {
                cb && cb(error, results);
            } 
        });
    }

    function buildVenuesSearchEndpoint(client, centroid, radius) {
      return  '/v2/venues/search?' 
        + 'll=' + centroid.join(',') + '&' 
        + 'radius=' + radius + '&' 
        + 'client_id=' + client.id + '&' 
        + 'client_secret=' + client.secret + '&' 
        + 'intent=browse&'
        + 'limit=50&' 
        + API_VERSION;
    }

    var Venue = function(venue) {
        var that = this;
        var loc = convert(venue);
        
        that.name = venue.name;
        that.id = venue.id;
        that.x = loc.x;
        that.y = loc.y;
        that.lat = loc.lat;
        that.lng = loc.lng;
        

        if (venue.hereNow) {
            that.herenow = venue.hereNow.count;
        }

        if (venue.categories && venue.categories.length > 0) {
            var subgroup3 = venue.categories[0];
            
            that.cat1 = subgroup3.name;
            
            if (subgroup3.parents && subgroup3.parents.length > 0) {
                that.cat2 = subgroup3.parents[0].name;
            } else {
                //console.log("subgroup 3", subgroup3.name, subgroup3.id);
            
                var lookup = reverseFsqCategories[subgroup3.id];
                if (lookup) {
                    that.cat2 = lookup.name;
                } else { 
                    console.warn('Subcategory not found', subgroup3); 
                } 

            }
        }

        that.toArray = function() {
            return [that.id, that.name, that.lat, that.lng, that.x, that.y, 
                    that.cat1, that.cat2, that.herenow];
        }
    }


    /** 
     *  Foursqure endpoint helper 
     **/
    function callEndpoint(endpoint, client, printmeta, cb) {

        request('https://api.foursquare.com' + endpoint, {}, function(error, response, body) {
           if (body) {
                var pres = JSON.parse(body);
                var rem  = (response.headers && response.headers[FSQ_RATE_LIMIT]) ? 
                           parseInt(response.headers[FSQ_RATE_LIMIT]) : 0;
                var success = pres.meta.code === 200;

                if (printmeta) {
                    console.log('headers:', pres.meta);
                }

                if (!success) {
                    console.warn(new Date().toISOString(), 'Non-normal return code:', pres, 'remaining:', rem);
                }
                
                cb && cb(null, {'client': client.id, 'endpoint': endpoint, 
                                'body': pres, 'success': success , 'remaining': rem});

            } else {
                // catch all
                cb && cb(error, null);
            }
        });
    }

    /** Insert results into the DB **/
    function insertDb(venues, cb) {
        
        if (!venues || venues.length == 0) {
            cb && cb();
            return;
        }

        var stmt = venues.filter(function (v) { return v && v.herenow > 0; }).map(toSql).join(',');
        //console.log(stmt);
        
        if (stmt && stmt !== '') {   
            connection.query('replace into uniq_venues values ' + stmt + ';',
                function(error, results) {                 
                    //console.log("Return from insert", results, error);

                    if (error) {
                        console.error('ERROR: ', error);
                    } else if (results && results.affectedRows > 0) {
                        console.log('Changed rows:', results.affectedRows);
                    }
                    cb && cb();
                });
        } else {
            cb && cb();
        }
    }

    function toSql(venue) {
        return '(' + connection.escape(venue.toArray().concat([(new Date()).toISOString()])) + ')';  
    }

    // add state plane data to output
    function convert(venue) {
        var loc = venue['location'];
        var planeCoord = nystateplane.convert(loc.lat, loc.lng);
        loc.x = planeCoord[0];
        loc.y = planeCoord[1];
        return loc; 
    }

    // cycles elements to fill desired array length
    function cycle(arr, size) {
        var ret = [];
        var len = arr.length;
        if (size > 0 && len > 0) {       
            for (i = 0; i < size; i++) {
                ret.push(arr[i % len]);  
            }
        }
        return ret;
    }


}) (process.argv[2]);
