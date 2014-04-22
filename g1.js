(function() {
  /* a Plots object is instantiated when the page loads, see bottom of JS file...*/
  var Plots = function() {
    /* the "nudge" function just autohides the "bars" on iOS devices, doesn't do anything in Chrome (at least, not that I noticed*/
    var nudge = function() {
      setTimeout(function(){ window.scrollTo(0,0); }, 1000);
    }
	/* here is where we "jump" to another "section"; note below that we added an event listener to the "window", listening for a "hashchange" event, on which we want to fire the function called "jump"; all it does it change the class name of the "body", then in CSS there is a rule that hides all the sections, with a later rule that "shows" the section whose "class" matches that of the body; slick
	As we add more view/pages/sections, we need to update this function and the CSS rules*/
    var jump = function() {
      switch(location.hash) {
        case '#add':
          document.body.className = 'add';
          break;
        case '#settings':
          document.body.className = 'settings';
          break;
        default:
          document.body.className = 'list';
		  /* we may want to change the default to one of the other screens we discussed*/
      }
	  /* any time we "jump", we want to re-"nudge"*/
      nudge();
    }
    jump();
    window.addEventListener('hashchange', jump, false);
    window.addEventListener('orientationchange', nudge, false);
    // localStorage portion: for setting the name and color scheme preference of the user
    var localStorageAvailable = ('localStorage' in window);
    var loadSettings = function() {
      if(localStorageAvailable) {
	  /* similar to sessionStorage, which we used in the PHP/pset7, this is just an associative array in which we have stored (or will/may store) two things: the user's name and their desired color scheme; the lines below first "get" the values, then "set" them to the appropriate places in the document (the HTML file)*/
        var name = localStorage.getItem('name'),
            colorScheme = localStorage.getItem('colorScheme'),
            nameDisplay = document.getElementById('user_name'),
            nameField = document.forms.settings.name,
            doc = document.documentElement,
            colorSchemeField = document.forms.settings.color_scheme;
        if(name) {
          nameDisplay.innerHTML = name+"'s";
          nameField.value = name;
        } else {
          nameDisplay.innerHTML = 'My';
          nameField.value = '';
        }
        if(colorScheme) {
          doc.className = colorScheme.toLowerCase();
          colorSchemeField.value = colorScheme;
        } else {
          doc.className = 'blue';
          colorSchemeField.value = 'Blue';
        } /* blue is the default if the user hasn't or doesn't select a scheme...*/
      }
    }
    // here we actually save the settings that the user selects, notice that it just sets key-value pairs into the localStorage via "setItem"; again, this is just like in PHP using the SESSION "superglobal"
    var saveSettings = function(e) {
      e.preventDefault();
      if(localStorageAvailable) {
        var name = document.forms.settings.name.value;
        if(name.length > 0) {
          var colorScheme = document.forms.settings.color_scheme.value;
          localStorage.setItem('name', name);
          localStorage.setItem('colorScheme', colorScheme);
          loadSettings();
          alert('Settings saved successfully', 'Settings saved');
          location.hash = '#list';
        } else {
          alert('Please enter your name', 'Settings error');
        }
      } else {
        alert('Browser does not support localStorage', 'Settings error');
      }
    }
    // here we allow the user to reset the settings saved in localStorage; there is also a dropDatabase function here...more on that a couple hundred lines down
    var resetSettings = function(e) {
      e.preventDefault();
      if(confirm('This will erase all data. Are you sure?', 'Reset data')) {
        if(localStorageAvailable) {
          localStorage.clear();
        }
        loadSettings();
        alert('Application data has been reset', 'Reset successful');
        location.hash = '#list';
        dropDatabase();
      }
    }
    // here is the call to actually load the settings when the page loads (that is, the Plots object is created at page load, and the next line fires when Plots is made, so the settings get loaded; we also add listeners for the two buttons on the Settings section
    loadSettings();
    document.forms.settings.addEventListener('submit', saveSettings, false);
    document.forms.settings.addEventListener('reset', resetSettings, false);
	
    // Now comes the complicated stuff........
	
	/* here we check if indexedDB is supported on the user's browser, if not we are going to fallback to webSQL; there are several names for indexedDB, as you'll see on the next line!*/
    var indexedDB = window.indexedDB || window.webkitIndexedDB
    || window.mozIndexedDB || window.msIndexedDB || false,
        IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange
    || window.mozIDBKeyRange || window.msIDBKeyRange || false,
        webSQLSupport = ('openDatabase' in window);
    // 
    var db;
	/* this big function just opens the database...whichever version the user's browser supports; you may want to do some reading on the "upgradeNeeded" jargin: it's basically something like this: you have to be in an upgradeNeeded event to create a new object store in indexedDB, there's a bit more to it, but we probably don't have to be experts anyway!*/
    var openDB = function() {
      if(indexedDB) {
        var request = indexedDB.open('plots', 1),
            upgradeNeeded = ('onupgradeneeded' in request);
		/* below, if the request is successful or not (that is, if the store exists...) we load the Plots*/
        request.onsuccess = function(e) {
          db = e.target.result;
          if(!upgradeNeeded && db.version != '1') {
            var setVersionRequest = db.setVersion('1');
            setVersionRequest.onsuccess = function(e) {
              var objectStore = db.createObjectStore('plots', {
                keyPath: 'id'
              });
			  // next line creates an index by which we implement searching
			  // syntax: createIndex(nameOfIndex,nameOfPropertyToPutIndexOn,options)
			  // note this is still inside of the indexedDB group
              objectStore.createIndex('desc', 'descUpper', {
                unique: false
              });
              loadPlots();
            }
          } else {
            loadPlots();
          }
        }
		/* if we didn't have "success", we don't have a store yet, lets make it*/
        if(upgradeNeeded) {
          request.onupgradeneeded = function(e) {
            db = e.target.result;
            var objectStore = db.createObjectStore('plots', {
              keyPath: 'id'
            });
            objectStore.createIndex('desc', 'descUpper', {
              unique: false
            });
          }
        }
      } else if(webSQLSupport) {
        db = openDatabase('plots','1.0','Plots database',(5*1024*1024));
		/* here is our more familiar friend, which unfortunately was dropped from the HTML5 standard; I suppose there are reasons...*/
        db.transaction(function(tx) {
          var sql = 'CREATE TABLE IF NOT EXISTS plots ('+
              'id INTEGER PRIMARY KEY ASC,'+
              'name TEXT,'+
              'desc TEXT,'+
			  'germ INTEGER,'+
			  'mature INTEGER,'+
              'createdate DATETIME,'+
              'lastwatered DATETIME,'+
              'lastweeded DATETIME,'+
              'complete BOOLEAN'+
              ')';
			  /* note with webSQL it is necessary to specify a great deal of information about the store at the time the table is created, whereas we didn't give indexedDB ANY information about what we want to have "in" it...more on that later*/
          tx.executeSql(sql, [], loadPlots);
        });
      }
    }
    openDB();
    // we need a message to display on the "list" section if the user has no Plots; they could either: (1) have entered search criteria that returned an empty set, or (2) not have any Plots whatsoever; handle both cases
    var createEmptyItem = function(query, plotList) {
      var emptyItem = document.createElement('li');
      if(query.length > 0) {
        emptyItem.innerHTML = '<div class="item_title">'+
          'No plots match your query <strong>'+query+'</strong>.'+
          '</div>';
      } else {
        emptyItem.innerHTML = '<div class="item_title">'+
          'No plots to display. <a href="#add">Add one</a>?'+
          '</div>';
      }
      plotList.appendChild(emptyItem);
    }
	// now we need a function to show a plot on our "list" section; recall that we left an empty <ul> with id="plot_list" in the HTML, here we'll dump in the <li>s
    var showPlot = function(plot, list) {
      var newItem = document.createElement('li'),
          checked = (plot.complete == 1) ? ' checked="checked"' : '';
      newItem.innerHTML =
        '<div class="item_complete">'+
        '<input type="checkbox" name="item_complete" '+
        'id="chk_'+plot.id+'"'+checked+'>'+
        '</div>'+
        '<div class="item_delete">'+
        '<a href="#" id="del_'+plot.id+'">Delete</a>'+
        '</div>'+
        '<div class="item_title">'+plot.name+': '+plot.desc+'</div>'+
        '<div class="item_created">Germination Time: '+plot.germ+'</div>'+
        '<div class="item_created">Maturity: '+plot.mature+'</div>'+
        '<div class="item_created">Planted:'+plot.createdate+'</div>'+
        '<div class="item_created">Watered:'+plot.lastwatered+'</div>'+
        '<div class="item_created">Weeded:'+plot.lastweeded+'</div>';
		/* we may want different formatting for the "stuff" in this display, but I've reused some of the existing classes (such as item_created) since I already had them and wasn't sure what all we even want to display here
		*A note on the "completed" checkbox: I was thinking that this could be set only to display when there was "action" needed (watering, weeding, etc.) on the item, then if the user "completed" it, they'd be able to "check" it; if the Plot was in good shape, they wouldn't even see the checkbox
		*We might actually need multiple checkboxes if we want "watered" to be "complete-able" separately from "weeding", for example; what do you think? */
		// TODO display the DATES of anticipated germ/mature instead of the number of days...then maybe if the germination date has passed, don't show it...?
      list.appendChild(newItem);
	  /* here's our function to mark the plot "complete", this will need work if we have multiple checkboxes, or if we want to handle completion of tasks differently*/
      var markAsComplete = function(e) {
        e.preventDefault();
        var updatedPlot = {
          id: plot.id,
		  name: plot.name,
          desc: plot.desc,
		  germ: plot.germ,
		  mature: plot.mature,
          descUpper: plot.desc.toUpperCase(),
          createdate: plot.createdate,
		  lastwatered: plot.lastwatered,
		  lastweeded: plot.lastweeded,
          complete: e.target.checked
        };
        updatePlot(updatedPlot);
      }
	  /* here is how we remove a plot*/
      var remove = function(e) {
        e.preventDefault();
        if(confirm('Deleting plot. Are you sure?', 'Delete')) {
          deletePlot(plot.id);
        }
      }
	  /* here is how the markAsComplete/remove functions actually occur */
      document.getElementById('chk_'+plot.id).onchange =
        markAsComplete;
      document.getElementById('del_'+plot.id).onclick = remove;
    }
    // this is where we actually load the plots, we grab the <li> (using it's id...), blank it out, then check which db version we're using...
    var loadPlots = function(q) {
      var plotList = document.getElementById('plot_list'),
          query = q || '';
      plotList.innerHTML = '';
	  /* if indexedDB, then create a transaction, grab the store, set the cursor*/
      if(indexedDB) {
        var tx = db.transaction(['plots'], 'readonly'),
            objectStore = tx.objectStore('plots'), cursor, i = 0;
		/* if a query was passed in, use it (this is in the event of a "search"*/
        if(query.length > 0) {
          var index = objectStore.index('desc'),
              upperQ = query.toUpperCase(),
              keyRange = IDBKeyRange.bound(upperQ, upperQ+'z');
          cursor = index.openCursor(keyRange);
        } else {
          cursor = objectStore.openCursor();
        }
		/* assuming we now have our cursor ready with our results, we need to call our showPlot function for each of the plots; the next line is a somewhat convoluted "while" loop: it calls the anonymous function, sets "result", checks if the result is null, if so: STOP, otherwise increment, show the plot (which just builds HTML, basically), rinse and repeat */
        cursor.onsuccess = function(e) {
          var result = e.target.result;
          if(result == null) return;
          i++;
          showPlot(result.value, plotList);
          result['continue']();
        }
		/* when we're done, if i has never changed, then we must not have had any plots, so show the corresponding message (per our createEmptyItem function define earlier)*/
        tx.oncomplete = function(e) {
          if(i == 0) { createEmptyItem(query, plotList); }
        }
      } else if(webSQLSupport) {
        db.transaction(function(tx) {
		  /* here, we'll do essentially the same thing, but with webSQL instead of indexedDB*/
          var sql, args = [];
          if(query.length > 0) {
            sql = 'SELECT * FROM plots WHERE desc LIKE ?';
            args[0] = query+'%';
          } else {
            sql = 'SELECT * FROM plots';
          }
          var iterateRows = function(tx, results) {
            var i = 0, len = results.rows.length;
			/* this loop is a little friendlier! */
            for(;i<len;i++) {
              showPlot(results.rows.item(i), plotList);
            }
            if(len === 0) { createEmptyItem(query, plotList); }
          }
          tx.executeSql(sql, args, iterateRows);
        });
      }
    }
    // here is our search function and a listener to "fire" it
    var searchPlots = function(e) {
      e.preventDefault();
	  /* grab the "value" (what the user typed) from the search field in the document*/
      var query = document.forms.search.query.value;
	  /* make sure they actually typed something in before we go trying to search for it!*/
      if(query.length > 0) {
        loadPlots(query);
      } else {
        loadPlots();
		/* no error, just show everything if they left it blank*/
      }
    }
    document.forms.search.addEventListener('submit', searchPlots, false);
    // here we have the method for inserting a new plot
    var insertPlot = function(e) {
      e.preventDefault();
  	  // here is a little dance that leads us to today's date as dd/mm/yyyy (do you guys prefer mm/dd/yyyy or something else?
	  var today = new Date();
      var dd = today.getDate();
      var mm = today.getMonth()+1; /* January is month 0, not 1 */
      var yyyy = today.getFullYear();
      if(dd<10){dd='0'+dd} if(mm<10){mm='0'+mm}
	  var today = dd+'/'+mm+'/'+yyyy;
      // now, we grab the values the user typed into the fields we provided
      var name = document.forms.add.plotname.value,
		  desc = document.forms.add.desc.value,
		  germ = document.forms.add.germ.value,
		  mature = document.forms.add.mature.value;
	  /* ensure they filled them all out*/
	  /* TODO: we don't actually want to require all of these, so we need logic here (and elsewhere) that will allow them to leave fields blank */
      if(name.length > 0 && desc.length > 0 && germ > 0 && mature > 0) {
        var plot = {
          id: new Date().getTime(),
		  name: name,
          desc: desc,
		  germ: germ,
		  mature: mature,
          descUpper: desc.toUpperCase(),
          createdate: today,
		  lastwatered: today,
		  lastweeded: today,
          complete: false
        }
		/* so, now all the "stuff" is store in an array; check DB type and add the Plot */
        if(indexedDB) {
          var tx = db.transaction(['plots'], 'readwrite');
          var objectStore = tx.objectStore('plots');
		  /* it's pretty sweet how you can dump an array into the store...*/
          var request = objectStore.add(plot);
          tx.oncomplete = updateView;
        } else if(webSQLSupport) {
          db.transaction(function(tx) {
			/* this, however, is more familiar to us, I'd imagine...*/
            var sql = 'INSERT INTO plots(name, desc, germ, mature, createdate, lastwatered, lastweeded, complete) '+
                'VALUES(?, ?, ?, ?, ?, ?, ?, ?)',
                args = [plot.name, plot.desc, plot.germ, plot.mature, plot.createdate, plot.lastwatered, plot.lastweeded, plot.complete];
            tx.executeSql(sql, args, updateView);
			/* webSQL may be a bit more straightforward, but it's also more verbose */
          });
        }
      } else {
        alert('Please fill out all fields', 'Add plot error');
      }
    }
	/* here is where we actually call the loadPlots function, then alert (via browser popup) that the Plot was added, then wipe out the fields so that they can add another one */
    function updateView(){
      loadPlots();
      alert('Plot added successfully', 'Plot added');
      document.forms.add.plotname.value = '';
      document.forms.add.desc.value = '';
	  document.forms.add.germ.value = '';
	  document.forms.add.mature.value = '';
      location.hash = '#list';
    }
	/* here is the listener for the GoAPE! button and the Cancel button */
    document.forms.add.addEventListener('submit', insertPlot, false);
	var btnAddPlotCancel = document.getElementById("addPlotCancel");
	// I'd like to be able to "cancel" (that is, redirect) without needing the id on the button input element...but I could figure out a better way to do this. Anyone, ..., anyone, ...anyone, ...Bueller?
	btnAddPlotCancel.addEventListener('click', function (){
		location.hash = '#list';
		// TODO: add logic to clear the fields on forms.add when the user cancels (see function updateView just a few lines above here...I haven't added it yet since I'm not sure what else we need to change and didn't want to change it twice...
	});
    // here is where we change the "complete" field (i.e., the checkbox...)
    var updatePlot = function(plot) {
      if(indexedDB) {
        var tx = db.transaction(['plots'], 'readwrite');
        var objectStore = tx.objectStore('plots');
        var request = objectStore.put(plot);
      } else if(webSQLSupport) {
        var complete = (plot.complete) ? 1 : 0;
        db.transaction(function(tx) {
          var sql = 'UPDATE plots SET complete = ? WHERE id = ?',
              args = [complete, plot.id];
          tx.executeSql(sql, args);
        });
      }
    }
	// here we have a method to delete a plot, this happens in concert with "remove" above...
    var deletePlot = function(id) {
      if(indexedDB) {
        var tx = db.transaction(['plots'], 'readwrite');
        var objectStore = tx.objectStore('plots');
        var request = objectStore['delete'](id);
        tx.oncomplete = loadPlots;
      } else if(webSQLSupport) {
        db.transaction(function(tx) {
          var sql = 'DELETE FROM plots WHERE id = ?',
              args = [id];
          tx.executeSql(sql, args, loadPlots);
        });
      }
    }
    // here we allow the user to drop (kill, remove, annihilate) the database; this drops the whole "plots" store, not just the table we've made in it
    var dropDatabase = function() {
      if(indexedDB) {
        var delDBRequest = indexedDB.deleteDatabase('plots');
        delDBRequest.onsuccess = window.location.reload();
      } else if(webSQLSupport) {
        db.transaction(function(tx) {
          var sql = 'DELETE FROM plots';
          tx.executeSql(sql, [], loadPlots);
        });
      }
    }
    // this caches the application locally, so the user can actually continue using the app without WiFi...just playing around with it, we probably don't need this, but I thought it might help us with the "events" that we need to warn the user of
    if('applicationCache' in window) {
      var appCache = window.applicationCache;
      appCache.addEventListener('updateready', function() {
        appCache.swapCache();
        if(confirm('App update is available. Update now?')) {
          w.location.reload();
        }
      }, false);
    }
  }
  /* here is where we add the listener on the "window", listening for a "load" event, and when it "hears" it, fire the anonymous function that instantiates a new Plots object (which basically consists of all the functions in this file...*/
  window.addEventListener('load', function() {
    new Plots();
  }, false);
})();

/* Hope you like it, there's a lot of work to do still. I think we should be careful about making major changes since we don't have a good debugger (unless you know of one?). I just use Notepad++, but it's just a text editor. Makes it pretty colors, but doesn't have any idea whether syntax is valid. In other words, I think we should try to keep from stepping on one another's toes while we work, probably by working on separate things. There is plenty to split up right now!

For example:
- adding the two "views" on the "list" section
- adding a map in the "list" section (just a "default" map, then we can tie it to the first listed Plot's coords (which are not in the DB yet...) afterwards
- adding the cool images to the right places
- working on the logic for the "events" and how we want to "deal" with them (not just as programmers, but as users)
- registering, logging in, etc.
- un-requiring that the user enter values for every field

Maybe we need a thorough task list?

Other thoughts:
- I'm thinking that since the Maps API takes the coords as a string in the API call, we just add a TEXT column called "coords" to our DB; a good example/explanation of the geolocation is here: http://diveintohtml5.info/geolocation.html
- If we keep the "search" feature, we may want to change which field it searches (currently "desc") and add some functionality to the "search results" list; right now to get back to the plot list you have to delete the search criteria, then re-search (or refresh the browser...); maybe when there was a search query used, after the last <li> we could put a "back to all Plots" href or something (not in the <ul>, but outside of it...)


*/
