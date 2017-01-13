/**
 *  __          __  _    _____ _____  ______ 
 *  \ \        / / | |  |_   _|  __ \|  ____|
 *   \ \  /\  / /__| |__  | | | |  | | |__   
 *    \ \/  \/ / _ \ '_ \ | | | |  | |  __|  
 *     \  /\  /  __/ |_) || |_| |__| | |____ 
 *      \/  \/ \___|_.__/_____|_____/|______|
 *                                                                            
 *  @author André Ferreira <andrehrf@gmail.com>
 *  @license MIT
 */

"use strict";

(function(){    
    webide.file = {
        /**
         * Function to get file informations 
         * 
         * @params string filename
         * @return void
         */
        open: function(filename){
            filename = encodeURIComponent(filename).replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A').replace(/%20/g, '+');//Bugfix @see http://locutus.io/php/url/urlencode/
            
            webide.getContentsJSON("GET", "/open?filename=" + filename, null, function(fileStats){
                if(fileStats.stat.size >= 16777216)//2Mb
                    webide.file.stream(fileStats)
                else
                    webide.file.get(fileStats);
            });
        },
        
        /**
         * Function to open big files
         * 
         * @param object fileStats
         * @return void
         */
        stream: function(fileStats){
            
        },
        
        /**
         * Function to get file data
         * 
         * @param object fileStats
         * @return void 
         */
        get: function(fileStats){
            filename = encodeURIComponent(fileStats.filename).replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A').replace(/%20/g, '+');//Bugfix @see http://locutus.io/php/url/urlencode/
               
            if(!webide.tabs.hasByPath(fileStats.filename)){
                webide.getContents("GET", "/data?filename=" + filename, null, function(data){
                    webide.file.createTabByMime(fileStats, data);
                });
            }
            else{
                webide.tabs.focusByPath(fileStats.filename);
            }
        },
        
        /**
         * Function to create tab and configure according to file mime
         * 
         * @param object fileStats
         * @param mixed data
         * @return void
         */
        createTabByMime(fileStats, data){
            webide.tabs.add(fileStats.basename, fileStats.filename, "editor", null, function(id, editor){
                var textarea = $(id + ' textarea[name="code"]').hide();
                editor.getSession().setValue(data);
                editor.getSession().on('change', function(){
                    textarea.val(editor.getSession().getValue());
                });

                switch(fileStats.mime){
                    case "application/json": editor.session.setMode("ace/mode/json"); break;
                    case "application/javascript": editor.session.setMode("ace/mode/javascript"); break;
                    default: editor.session.setMode("ace/mode/text"); break;
                }
            });
        }
    }
})();