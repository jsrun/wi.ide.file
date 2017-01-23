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

webide.module("file", function(tabs, commands){    
    //Register editor type
    tabs.layout.registerComponent('editor', function(container, state){
        container.id = state.id;
        container.getElement().html("<div id='wi-ed-" + state.id + "'></div>");     
        webide.tabs.itens[state.id].container = container;
                
        setTimeout(function(){
            var settings = webide.settings.getByPattern(/^ace\.editor\..*?$/i);
            var theme = webide.settings.get("ace.editor.theme");                        
            theme = (!theme) ? "ace/theme/twilight" : "ace/theme/" + theme;

            var editor = ace.edit("wi-ed-" + state.id);
            editor.setTheme(theme);
            editor.setOptions({enableBasicAutocompletion: true, enableSnippets: true, enableLiveAutocompletion: false});

            for(var key in state.settings){
                if(key !== "ace.editor.theme"){
                    if(state.settings[key] == "true") state.settings[key] = true;//Bugfix
                    if(state.settings[key] == "false") state.settings[key] = false;//Bugfix

                    if(!isNaN(parseInt(state.settings[key])))
                        state.settings[key] = parseInt(state.settings[key]);

                    editor.setOption(key.replace(/ace\.editor\./img, ""), state.settings[key]);
                }
            }

            webide.tabs.itens[state.id].editor = editor;
            editor.resize();

            if(typeof webide.tabs.itens[state.id].cb == "function")
                setTimeout(function(state, editor){ webide.tabs.itens[state.id].cb(state.id, editor); }, 300, state, editor);
        }, 100);
    });
    
    //Register stream type
    tabs.layout.registerComponent('stream', function(container, state){
        container.id = state.id;
        container.getElement().html("<div id='wi-ed-" + state.id + "'></div><div id='wi-stream-" + state.id + "'></div>");
        webide.tabs.itens[state.id].container = container;
        
        if(typeof webide.tabs.itens[state.id].cb == "function")
            setTimeout(function(state){ webide.tabs.itens[state.id].cb(state.id); }, 300, state);
    });
    
    commands.add("webide:newproject", function(){
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
                    webide.terminal.create("root", function(terminal, id){
                        var data = webide.forms.data("#newproject-form");
                        data["terminal"] = id;
                        
                        terminal.disable();
                        terminal.find('.cursor').hide();
                        terminal.find('.prompt').hide();     
                        
                        webide.sendJSON($("#newproject-form").attr("action"), data);//Request create new project
                        $(".wi-window-modal").css("display", "none");//Hide modal
                    });
                }
            });
            
            $(".wi-btn-cancel").click(function(){ $(".wi-window-modal").css("display", "none"); });
        });
    });
    
    this.io.on('workspace:refresh', function (data) {
        webide.treeview.create(".wi-treeview");
    });
    
    this.file = {
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
                var textarea = $("#wi-ed-" + id + ' textarea');
                
                editor.getSession().setValue(data);
                editor.getSession().on('change', function(){
                    var dmp = new diff_match_patch();
                    var diff = dmp.diff_main(editor.getSession().getValue(), data, true);
                    dmp.diff_cleanupSemantic(diff);
                    
                    var lines  = editor.getSession().doc.getAllLines().length;
                    var offset = 0;
                    
                    $("#wi-ed-" + id + ' .ace_gutter .ace_gutter-cell').css("border-left", "");
                                       
                    var Range = ace.require('ace/range').Range;
                    editor.getSession().addMarker(new Range(0,0,10,10), "line", 'fullLine');
                                        
                    /**
                     * @see https://github.com/benkeen/ace-diff/blob/master/dist/ace-diff.js
                     * @see http://stackoverflow.com/questions/25083183/how-can-i-get-and-patch-diffs-in-ace-editor
                     * @see http://stackoverflow.com/questions/10452869/when-i-try-to-create-a-range-object-in-ace-js-an-illegal-constructor-error-is
                     */
                    var offset = 0;
                    diff.forEach(function(chunk) {
                        var op = chunk[0];
                        var text = chunk[1];
                        
                        switch(op){
                            case 0: offset += text.length; break;
                            case -1: 
                                /*editor.getSession().addMarker(Range.fromPoints(
                                    editor.getSession().doc.indexToPosition(offset),
                                    editor.getSession().doc.indexToPosition(offset + text.length)
                                ), "ace_active-line", "fullLine");*/

                                for(var key = editor.getSession().doc.indexToPosition(offset).row; key < editor.getSession().doc.indexToPosition(offset + text.length).row; key++)
                                    $("#wi-ed-" + id + ' .ace_gutter .ace_gutter-cell').eq(key).css("border-left", "3px solid #53ef53");

                                offset += text.length;
                            break;
                            case 1: 
                                 /*editor.getSession().addMarker(Range.fromPoints(
                                    editor.getSession().doc.indexToPosition(offset),
                                    editor.getSession().doc.indexToPosition(offset + text.length)
                                ), "ace_active-line", "fullLine");*/

                                for(var key = editor.getSession().doc.indexToPosition(offset).row; key <= editor.getSession().doc.indexToPosition(offset + text.length).row; key++)
                                    $("#wi-ed-" + id + ' .ace_gutter .ace_gutter-cell').eq(key).css("border-left", "3px solid #8484ff");

                                offset += text.length;
                            break;
                        }
                    });       
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
                    case "yaml":
                        if(fileStats.basename == "docker-compose.yml"){
                            $("#wi-ed-" + id).css("width", "50%");
                            $("#wi-ed-" + id).parent().append('<div class="wi-file-docker-compose-editor"></div>');
                            
                            webide.getContents("GET", "/docker-compose-editor", null, function(contentsDockerComposerEditor){
                                $(".wi-file-docker-compose-editor", $("#wi-ed-" + id).parent()).html(contentsDockerComposerEditor);
                                
                                if($("#jsyaml").length <= 0){
                                    var jsYamlJS = document.createElement("script");
                                    jsYamlJS.id = "jsyaml";     
                                    jsYamlJS.src = "/js-yaml.min.js";
                                    jsYamlJS.onload = function(){
                                        console.log(jsyaml.safeLoad(data, jsyaml.JSON_SCHEMA));
                                        //$(".wi-file-docker-compose-editor", $("#wi-ed-" + id).parent()).html(jsyaml.safeLoad(data, jsyaml.JSON_SCHEMA));
                                    };

                                    document.body.appendChild(jsYamlJS);
                                }
                            });
                        }
                    break;
                }
            });
        }
    };
});