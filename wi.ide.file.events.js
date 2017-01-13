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
         * 
         */
        modesByMime: {
            "text/vnd.abc": "abc",
            "application/x-actionscript": "actionscript", "text/x-actionscript": "actionscript",
            "application/x-applescript": "applescript",
            "text/x-asciidoc": "asciidoc",
            "application/bat": "batchfile", "application/x-bat": "batchfile",
            "text/x-c": "c_cpp",
            "text/x-csharp": "csharp",
            "application/x-pointplus": "css", "text/css": "css",
            "application/dart": "dart",
            "text/html": "html",
            "text/x-markdown": "markdown",
            "application/json": "json",
            "application/javascript": "javascript"
        },
        
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
                    console.log(fileStats.mime);
                    webide.file.createTabByMime(fileStats, data);
                });
            }
            else{
                webide.tabs.focusByPath(fileStats.filename);
            }
        },
        
        setModeByMime: function(mime, mode){
            this.modesByMime[mime] = mode;
        },
        
        /**
         * Function to create tab and configure according to file mime
         * 
         * @param object fileStats
         * @param mixed data
         * @return void
         */
        createTabByMime: function(fileStats, data){   
            var _this = this;
            
            webide.tabs.add(fileStats.basename, fileStats.filename, "editor", null, function(id, editor){
                var textarea = $("#wi-ed-" + id + ' textarea[name="code"]').hide();
                editor.getSession().setValue(data);
                editor.getSession().on('change', function(){
                    textarea.val(editor.getSession().getValue());
                });
                     
                try{ var mode = (typeof _this.modesByMime[fileStats.mime] == "string") ? _this.modesByMime[fileStats.mime] : "text"; }
                catch(e){ var mode = "text"; }
                
                editor.session.setMode("ace/mode/" + mode);
                                
                switch(mode){
                    case "markdown":
                        console.log(id);
                        //webide.tabs.addToolbar(id);
                        $("#wi-ed-" + id).css("width", "50%");
                        $("#wi-tc-" + id).append('<div class="wi-file-preview-markdown"></div>'+
                                                 '<link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/highlight.js/9.9.0/styles/default.min.css">');
                                       
                        if($("#hljs").length <= 0){
                            var hljsJs = document.createElement("script");
                            hljsJs.id = "hljs";     
                            hljsJs.src = "//cdnjs.cloudflare.com/ajax/libs/highlight.js/9.9.0/highlight.min.js";
                            hljsJs.onload = function(){
                                hljs.initHighlightingOnLoad();
                                
                                marked.setOptions({
                                    highlight: function (code) {
                                        return hljs.highlightAuto(code).value;
                                    }
                                });
                                
                                $(".wi-file-preview-markdown", "#wi-tc-" + id).html(marked(data));
                            };
                            
                            document.body.appendChild(hljsJs);
                        }                        
                        
                        $(".wi-file-preview-markdown", "#wi-tc-" + id).html(marked(data));
                        
                        editor.getSession().on('change', function(){
                            $(".wi-file-preview-markdown", "#wi-tc-" + id).html(marked(editor.getSession().getValue()));
                        });
                    break;
                }
            });
        }
    }
})();