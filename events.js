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

webide.module("file", function(tabs, commands, treeview, settings, terminal, forms, statusbar){        
    //Register editor type
    tabs.layout.registerComponent('editor', function(container, state){
        container.id = state.id;
        container.getElement().html("<div id='wi-ed-" + state.id + "'></div>");     
        tabs.itens[state.id].container = container;
        
        container.on("resize", function(){
            if(typeof tabs.itens[state.id].editor == "object")
                tabs.itens[state.id].editor.resize();
        });
                
        setTimeout(function(){
            var settingsObj = settings.getByPattern(/^ace\.editor\..*?$/i);
            var theme = settings.get("ace.editor.theme");                        
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

            tabs.itens[state.id].editor = editor;
            editor.resize();
            
            /*setTimeout(function(){
                $("#wi-ed-" + state.id).minimap({
                    heightRatio : 0.6,
                    widthRatio : 0.1,
                    offsetHeightRatio : 0.080,
                    offsetWidthRatio : 0.025,
                    position : "right",
                    touch: true,
                    smoothScroll: true,
                    smoothScrollDelay: 200,
                });
            }, 1000);*/

            if(typeof tabs.itens[state.id].cb == "function")
                setTimeout(function(state, editor){ tabs.itens[state.id].cb(state.id, editor); }, 300, state, editor);
        }, 100);
    });
    
    //Register stream type
    tabs.layout.registerComponent('stream', function(container, state){
        container.id = state.id;
        container.getElement().html("<div id='wi-ed-" + state.id + "'></div><div id='wi-stream-" + state.id + "'></div>");
        tabs.itens[state.id].container = container;
        
        if(typeof tabs.itens[state.id].cb == "function")
            setTimeout(function(state){ tabs.itens[state.id].cb(state.id); }, 300, state);
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
                if(forms.validate("#newproject-form")){
                    terminal.create(function(terminal, id, termID){
                        var data = forms.data("#newproject-form");
                        data["id"] = id;
                        data["termID"] = termID;
                        data["ports"] = [];
                        
                        $(".wi-window-workspace-bind-port-body table tr").each(function(){
                            var from = $(this).find("input").eq(0).val();
                            var to = $(this).find("input").eq(1).val();
                            
                            if(from && to)
                                var bind = from+":"+to;
                            else if(to)
                                var bind = to;
                            else
                                var bind = "";
                            
                            if(bind)
                                data["ports"].push(bind);
                        })
                           
                        setTimeout(function(data){ webide.sendJSON($("#newproject-form").attr("action"), data); }, 1000, data); //Request create new project
                        $(".wi-window-modal").css("display", "none");//Hide modal
                    });
                }
            });
            
            $(".wi-window-workspace-bind-port-btn-add").click(function(){
                $(".wi-window-workspace-bind-port-body table").append("<tr>"+
                                                                      "    <td><input type=\"text\" placeholder=\"8080\" /></td>"+
                                                                      "    <td><input type=\"text\" placeholder=\"80\" /></td>"+
                                                                      "    <td><button class=\"wi-window-workspace-bind-port-btn-close\"><i class=\"fa fa-times\" aria-hidden=\"true\"></i></button></td>"+
                                                                      "</tr>");
                                                              
                $(".wi-window-workspace-bind-port-btn-close").click(function(){
                    $(this).parent().parent().remove(); 
                });
            });
            
            $(".wi-btn-cancel").click(function(){ $(".wi-window-modal").css("display", "none"); });
            $('.tooltip').tooltipster({theme: 'tooltipster-punk'});
        });
    });
        
    commands.add("file:new", function(){
        webide.file.createTabByMime({
            filename: "/untitled"+webide.file.newpointer,
            basename: "untitled"+webide.file.newpointer,
            mime: "text/plain" 
        }, "");
        
        webide.file.newpointer++;
    });
    
    commands.add("file:save", function(){
        console.log(tabs.getActiveTab()); 
    });
    
    this.io.on('workspace:refresh', function (data) {
        treeview.create(".wi-treeview");
    });
    
    treeview.create("#workspace-treeview", {contextmenu: function(node, span, type){
        switch(type){
            case "container": 
                $(span).contextMenu({menu: "containerContextMenu"}, function(action, el, pos) {
                    switch(action){
                        case "build": terminal.exec(node.key, "docker-compose build --no-cache --force-rm", "workspace:refresh"); break;
                        case "create": terminal.exec(node.key, "docker-compose create --force-recreate --build ", "workspace:refresh"); break;
                        case "start": terminal.exec(node.key, "docker-compose start " + node.data.serviceName.toLowerCase(), "workspace:refresh"); break;
                        case "restart": terminal.exec(node.key, "docker-compose restart " + node.data.serviceName.toLowerCase(), "workspace:refresh"); break;
                        case "pause": terminal.exec(node.key, "docker-compose pause " + node.data.serviceName.toLowerCase(), "workspace:refresh"); break;
                        case "unpause": terminal.exec(node.key, "docker-compose unpause " + node.data.serviceName.toLowerCase(), "workspace:refresh"); break;
                        case "stop": terminal.exec(node.key, "docker-compose stop " + node.data.serviceName.toLowerCase(), "workspace:refresh"); break;
                        case "up": terminal.exec(node.key, "docker-compose up -d --remove-orphans", "workspace:refresh"); break;
                        case "down": terminal.exec(node.key, "docker-compose down --remove-orphans", "workspace:refresh"); break;
                        case "settings": webide.file.open(node.key + "/docker-compose.yml");  break;
                        case "exec": terminal.exec(node.key, null, null, false, true); break;
                        case "delete": 
                            webide.confirm("Remove folder", "Do you really want to remove the container " + node.data.serviceName + " ?", {width: 400, height: 130}, function(){
                                webide.file.delete(node.key);
                            }); 
                        break;
                    }
                });
            break;
            case "folder": 
                $(span).contextMenu({menu: "diretoryContextMenu"}, function(action, el, pos) {
                    switch(action){
                        case "open": $(node.span).click(); break;
                        case "download": webide.file.download(node.key); break;
                        case "refresh": node.tree.reload(); break;
                        case "rename": node.editStart(); break;
                        case "delete": 
                            webide.confirm("Remove folder", "Do you really want to remove the folder " + node.key + " ?", {width: 400, height: 130}, function(){
                                webide.file.delete(node.key);
                            }); 
                        break;
                        case "openterminal": terminal.exec(node.key, null, null, false, true); break;
                        case "copyfilepath": 
                            $("body").append("<button style='display:none' data-clipboard-text='"+node.key+"' id='cbi'></button>");

                            var clipboard = new Clipboard("#cbi");
                            clipboard.on('success', function(e) { e.clearSelection(); });
                            $("#cbi").click();
                            clipboard.destroy();
                            $("#cbi").remove();
                        break;
                    }
                });
            break;
            case "file":                 
                $(span).contextMenu({menu: "fileContextMenu"}, function(action, el, pos) {   
                    switch(action){
                        case "open": webide.file.open(node.key); break;
                        case "download": webide.file.download(node.key); break;
                        case "refresh": node.tree.reload(); break;
                        case "rename": node.editStart(); break;
                        case "delete": 
                            webide.confirm("Remove file", "Do you really want to remove the file " + node.key + " ?", {width: 400, height: 130}, function(){
                                webide.file.delete(node.key);
                            }); 
                        break;
                        case "openterminal": 
                            terminal.exec(dirname(node.key), basename(node.key), null, false, true); 
                            
                            /**
                             * @see http://locutus.io/php/filesystem/dirname/
                             * @see http://locutus.io/php/filesystem/basename/
                             */
                            function dirname(path){
                                return path.replace(/\\/g, '/').replace(/\/[^\/]*\/?$/, '');
                            }
                            
                            function basename(path, suffix){
                                var b = path
                                var lastChar = b.charAt(b.length - 1)

                                if(lastChar === '/' || lastChar === '\\')
                                    b = b.slice(0, -1)
                                
                                b = b.replace(/^.*[\/\\]/g, '');

                                if(typeof suffix === 'string' && b.substr(b.length - suffix.length) === suffix)
                                    b = b.substr(0, b.length - suffix.length)
                                
                                return b
                            }
                        break;
                        case "copyfilepath": 
                            $("body").append("<button style='display:none' data-clipboard-text='"+node.key+"' id='cbi'></button>");

                            var clipboard = new Clipboard("#cbi");
                            clipboard.on('success', function(e) { e.clearSelection(); });
                            $("#cbi").click();
                            clipboard.destroy();
                            $("#cbi").remove();
                        break;
                    }
                });
            break;
        }
    }, save: function(event, data){
        $.post("/rename", {filename: data.node.key, newname: data.input.val()}, function(data){});
    }});      
    
    this.extends("file", {
        /**
         * Pointer to new file
         * @type integer
         */
        newpointer: 1,
        
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
            "text/plain": "text",
            "text/yaml": "yaml"
        },
        
        /**
         * List of types by mode
         * @type object
         */
        typesByMode: {
            "actionscript": "Action Script",
            "applescript": "Apple Script",
            "batchfile": "Batch",
            "c_cpp": "C/C++",
            "csharp": "C#",
            "css": "CSS",
            "dart": "Dart",
            "html": "HTML",
            "markdown": "Markdown",
            "json": "JSON",
            "javascript": "JavaScript",
            "xml": "XML",
            "text": "Plain Text",
            "yaml": "YAML"
        },
        
        /**
         * Function to get file informations 
         * 
         * @param string filename
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
         * Function to start download
         * 
         * @param string filename
         * @return void
         */
        download: function(filename){
            filename = encodeURIComponent(filename).replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A').replace(/%20/g, '+');//Bugfix @see http://locutus.io/php/url/urlencode/
                        
            var a = document.createElement('a');
            a.href = "/download?filename=" + filename;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
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

                if(!tabs.hasByPath(filename)){
                    tabs.add(fileStats.basename, fileStats.filename, "stream", null, function(id){
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

                        xhr.onerror = function (e) { console.log(e); };

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
                                    var settings = settings.getByPattern(/^ace\.editor\..*?$/i);
                                    var theme = settings.get("ace.editor.theme");                        
                                    theme = (!theme) ? "ace/theme/twilight" : "ace/theme/" + theme;

                                    var editor = ace.edit("wi-ed-" + id);
                                    editor.setTheme(theme);
                                    editor.setOptions({enableBasicAutocompletion: true, enableSnippets: true, enableLiveAutocompletion: false});
                                    
                                    setTimeout(function(){ $("#wi-stream-" + id).remove(); }, 10000);
                                   
                                    tabs.itens[id].editor = editor;
                                    editor.resize(true);
                                }, 100);
                            }
                        }
                    });
                }
                else{
                    tabs.focusByPath(filename);
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
               
            if(!tabs.hasByPath(filename))
                this.getContents("GET", "/data?filename=" + filename, null, function(data){ webide.file.createTabByMime(fileStats, data); });
            else
                tabs.focusByPath(filename);
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
            
            tabs.add(fileStats.basename, fileStats.filename, "editor", null, function(id, editor){
                $('.lm_tab').tooltipster({theme: 'tooltipster-punk'});
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
                                for(var key = editor.getSession().doc.indexToPosition(offset).row; key < editor.getSession().doc.indexToPosition(offset + text.length).row; key++)
                                    $("#wi-ed-" + id + ' .ace_gutter .ace_gutter-cell').eq(key).css("border-left", "3px solid #53ef53");

                                offset += text.length;
                            break;
                            case 1: 
                                for(var key = editor.getSession().doc.indexToPosition(offset).row; key <= editor.getSession().doc.indexToPosition(offset + text.length).row; key++)
                                    $("#wi-ed-" + id + ' .ace_gutter .ace_gutter-cell').eq(key).css("border-left", "3px solid #8484ff");

                                offset += text.length;
                            break;
                        }
                    });
                    
                    var title = tabs.getTitle(id).replace(/\*/img, "");         
                    tabs.setTitle(id, (diff.length > 1) ? "* " + title : title);
                });
                
                editor.commands.addCommand({
                    name: 'editor:save',
                    bindKey: {
                        win: 'Ctrl-S',
                        mac: 'Command-S',
                        sender: 'editor|cli'
                    },
                    exec: function(env, args, request) {
                        _this.save(fileStats.filename, fileStats.mime, editor.getSession().getValue(), function(){
                            var title = tabs.getTitle(id).replace(/\*/img, "");         
                            tabs.setTitle(id, title);
                            data = editor.getSession().getValue();
                        });
                    }
                });
                
                editor.commands.addCommand({
                    name: 'editor:saveas',
                    bindKey: {
                        win: 'Ctrl-Shift-S',
                        mac: 'Command-Shift-S',
                        sender: 'editor|cli'
                    },
                    exec: function(env, args, request) {
                        console.log(env);
                    }
                });
                     
                try{ var mode = (typeof _this.modesByMime[fileStats.mime] == "string") ? _this.modesByMime[fileStats.mime] : "text"; }
                catch(e){ var mode = "text"; }
                
                editor.session.setMode("ace/mode/" + mode);
                
                $("#wi-ed-" + id).append("<div class='wi-ace-statusbar'>"+                                         
                                         "    <div class='wi-ace-statusbar-item-right wi-ace-statusbar-type'>" + _this.typesByMode[mode] + "</div>"+    
                                         "    <div class='wi-ace-statusbar-item-right wi-ace-statusbar-line'></div>"+
                                         "    <div class='wi-ace-statusbar-item-right'></div>"+
                                         "</div>");
                                 
                var refreshLine = setInterval(function(){
                    if(editor)
                        $("#wi-ed-" + id + " .wi-ace-statusbar-line").html(editor.selection.getCursor().row+":"+editor.selection.getCursor().column);
                    else
                        clearInterval(refreshLine);
                }, 100);
                                 
                $("#wi-ed-" + id + " .wi-ace-statusbar .wi-ace-statusbar-type").click(function(){                    
                    webide.windowRemote("/editor/types", {width: 500, height: 400}, function(){
                        $("input", ".wi-windows-select").keyup(function(){
                            var patt = new RegExp($(this).val(), "img");
                            console.log(patt);
                            $(".wi-windows-select-item").css("display", "");
                            
                            $(".wi-windows-select-item").each(function(){
                                if(!patt.test($(this).html()))
                                    $(this).css("display", "none");
                            }); 
                        });
                        
                        $(".wi-windows-select-item").click(function(){
                            editor.session.setMode("ace/mode/" + $(this).attr("rel"));
                            $("#wi-ed-" + id + " .wi-ace-statusbar .wi-ace-statusbar-type").html($(this).html());
                            webide.closeWindow();
                        });
                    });
                });
                                
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
        },
        
        /**
         * Function to save file
         * 
         * @param string filename
         * @param string mime
         * @param string contents
         * @param function fn
         * @return void
         */
        save: function(filename, mime, content, fn){
            var formData = new FormData();
            var blob = new Blob([content], {type: mime, size: content.length});
            formData.append('file', blob, filename);                   
            $.ajax({url: '/save', data: formData, cache: false, contentType: false, processData: false, type: 'POST', success: fn});
        },
        
        /**
         * Functio to remove file, diretory, container
         * 
         * @return void
         */
        delete: function(filename){
            filename = encodeURIComponent(filename).replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A').replace(/%20/g, '+');//Bugfix @see http://locutus.io/php/url/urlencode/
            webide.getContentsJSON("DELETE", "/delete", {filename: filename});
        }
    });
});