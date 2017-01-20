/**
 *  __          __  _    _____ _____  ______   ______ _ _      
 *  \ \        / / | |  |_   _|  __ \|  ____| |  ____(_) |     
 *   \ \  /\  / /__| |__  | | | |  | | |__    | |__   _| | ___ 
 *    \ \/  \/ / _ \ '_ \ | | | |  | |  __|   |  __| | | |/ _ \
 *     \  /\  /  __/ |_) || |_| |__| | |____ _| |    | | |  __/
 *      \/  \/ \___|_.__/_____|_____/|______(_)_|    |_|_|\___| 
 *                                                                            
 *  @author André Ferreira <andrehrf@gmail.com>
 *  @license MIT
 */

"use strict";

(function(){    
    webide.commands.add("webide:newproject", function(){
        webide.windowRemote('/window/newproject', {width: 1000, height: 550}, function(){            
            $(".wi-window-workspace-item").click(function(){
                $(".wi-window-workspace-item-active").removeClass("wi-window-workspace-item-active");
                $(this).addClass("wi-window-workspace-item-active");
                
                $("#wi-workspace-container-version option").remove();
                var item = JSON.parse($(this).attr("rel"));
                
                item.versions.forEach(function(version, index){
                    $("#wi-workspace-container-version").append("<option value='" + version + "'>" + version + "</option>");
                });
                
                $("#wi-workspace-container-image").val(item.image);
            });
            
            $(".wi-window-workspace-item:first").click();            
            $(".wi-btn-create").click(function(){
                if(webide.forms.validate("#newproject-form")){
                    webide.terminal.create("root", function(terminal){
                        terminal.disable();
                        terminal.find('.cursor').hide();
                        terminal.find('.prompt').hide();     
                        webide.sendJSON($("#newproject-form").attr("action"), webide.forms.data("#newproject-form"));
                        $(".wi-window-modal").css("display", "none");
                    });
                }
            });
            
            $(".wi-btn-cancel").click(function(){ $(".wi-window-modal").css("display", "none"); });
        });
    });
    
    webide.file = {
        /**
         * List of modes by mimes
         * @type object
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
            "application/javascript": "javascript",
            "application/xml": "xml",
            "text/yaml": "yaml"
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
                if(fileStats.stat.size >= 2097152)//2Mb
                    webide.file.stream(fileStats)
                else
                    webide.file.get(fileStats);
            });
        },
        
        /**
         * Function to open big files
         * 
         * @see https://github.com/jsrun/express-send-stream
         * @param object fileStats
         * @return void
         */
        stream: function(fileStats){
            if(confirm("Do you really want to open this file ?, the file is larger than recommended, can cause system slowdown")){
                var filename = encodeURIComponent(fileStats.filename).replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A').replace(/%20/g, '+');//Bugfix @see http://locutus.io/php/url/urlencode/

                if(!webide.tabs.hasByPath(filename)){
                    webide.tabs.add(fileStats.basename, fileStats.filename, "stream", null, function(id){
                        var xhr = new XMLHttpRequest();
                        xhr.overrideMimeType("application/octet-stream");
                        xhr.responseType = "arraybuffer";
                        
                        $("#wi-stream-" + id).append("<div class='wi-stream-progress-shadow'></div><div class='wi-stream-progress'><div class='wi-stream-progress-bar'></div></div>");

                        xhr.onprogress = function(progress){
                            $("#wi-stream-" + id + " .wi-stream-progress-bar").css("width", ((progress.loaded*100)/parseInt(xhr.getResponseHeader("File-size"))) + "%");
                        };

                        xhr.onload = function(v){
                            var byteArray = new Uint8Array(xhr.response);
                            renderStream(1, byteArray.byteLength, byteArray, 524288, "#code");
                        };

                        xhr.onerror = function (e) {
                            console.log(e);
                        };

                        xhr.open("GET", "/stream?filename=" + filename, true);
                        xhr.send();

                        function renderStream(byteStart, byteLength, byteArray, byteBlock, elem){
                            var blockString = "";

                            if(byteStart+byteBlock > byteLength)
                                byteBlock = (byteLength - byteStart)-1;

                            for(var i = byteStart; i <= (byteStart+byteBlock); i++)
                                blockString += String.fromCharCode(byteArray[i]);

                            document.querySelector("#wi-ed-" + id).appendChild(document.createTextNode(blockString));
                            $("#wi-stream-" + id + " .wi-stream-progress-bar").css("width", ((byteStart+byteBlock)*100)/(byteLength-1) + "%");
                            //console.log(byteStart,(byteStart+byteBlock),byteLength,(((byteStart+byteBlock)*100)/(byteLength-1) + "%"));

                            if(byteStart+byteBlock < byteLength-1){
                                setTimeout(renderStream, 200, (byteStart+byteBlock)+1, byteLength, byteArray, byteBlock, elem); 
                            }
                            else{
                                setTimeout(function(){
                                    var settings = webide.settings.getByPattern(/^ace\.editor\..*?$/i);
                                    var theme = webide.settings.get("ace.editor.theme");                        
                                    theme = (!theme) ? "ace/theme/twilight" : "ace/theme/" + theme;

                                    var editor = ace.edit("wi-ed-" + id);
                                    editor.setTheme(theme);
                                    editor.setOptions({enableBasicAutocompletion: true, enableSnippets: true, enableLiveAutocompletion: false});
                                    
                                    setTimeout(function(){ $("#wi-stream-" + id).remove(); }, 10000);
                                   
                                    webide.tabs.itens[id].editor = editor;
                                    editor.resize(true);
                                }, 100);
                            }
                        }
                    });
                }
                else{
                    webide.tabs.focusByPath(filename);
                }
            }
        },
        
        /**
         * Function to get file data
         * 
         * @param object fileStats
         * @return void 
         */
        get: function(fileStats){
            var filename = encodeURIComponent(fileStats.filename).replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A').replace(/%20/g, '+');//Bugfix @see http://locutus.io/php/url/urlencode/
               
            if(!webide.tabs.hasByPath(filename)){
                webide.getContents("GET", "/data?filename=" + filename, null, function(data){
                    webide.file.createTabByMime(fileStats, data);
                });
            }
            else{
                webide.tabs.focusByPath(filename);
            }
        },
        
        /**
         * Function to set mode by mime
         * 
         * @param string mime
         * @param string mode
         * @return void
         */
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
                        //webide.tabs.addToolbar(id);
                        $("#wi-ed-" + id).css("width", "50%");
                        $("#wi-ed-" + id).parent().append('<div class="wi-file-preview-markdown"></div>'+
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
                                
                                $(".wi-file-preview-markdown", $("#wi-ed-" + id).parent()).html(marked(data));
                            };
                            
                            document.body.appendChild(hljsJs);
                        }                        
                        
                        $(".wi-file-preview-markdown", $("#wi-ed-" + id).parent()).html(marked(data));
                        
                        editor.getSession().on('change', function(){
                            $(".wi-file-preview-markdown", $("#wi-ed-" + id).parent()).html(marked(editor.getSession().getValue()));
                        });
                    break;
                }
            });
        }
    }
})();