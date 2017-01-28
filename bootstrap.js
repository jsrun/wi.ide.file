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

let glob = require("glob"),
    fs = require("fs"),
    path = require('path'),
    es = require("event-stream"),
    mkdirp = require("mkdirp"),
    async = require("async"),
    zlib = require('zlib'),
    exec = require('child_process').exec,
    yaml = require('js-yaml'),
    DockerCompose = require("docker-compose-remote-api"),
    mime = require('mime-types'),
    git = require("nodegit"),
    promisify = require('promisify'),
    multipart = require('connect-multiparty'),
    targz = require('tar.gz'); 

module.exports = (_this) => {  
    _this.insertJs(__dirname + "/node_modules/marked/lib/marked.js");
    _this.insertJs(__dirname + "/diff_match_patch.js");
    
    //New Project
    _this.commands.addCommand({name: "webide:newproject", bind: {mac: "Command-N", win: "Ctrl-Shift-N"}});
    _this.navbar.addItem("File/New Project...", {command: "webide:newproject"}, 100);
    
    _this.app.get("/window/newproject", (req, res) => { res.render(__dirname + "/newproject.ejs", {projects: _this.run.getRunners()}); });
    _this.app.post("/window/newproject", (req, res) => { 
        let _id = (req.user) ? req.user._id : 0;
        let socket = _this._.getSocket(req.body.socket);
        let workspaceDirname = fs.realpathSync(__dirname + "/../../.workspaces/" + _id);
        
        if(socket){
            //socket.emit("terminal:stdout", req.body.id, "Starting workspace creation...");
               
            async.series([function(n){//Clone github
                if(req.body.git.clone){
                    _this.terminal.write(req.body.termID, "git clone " + req.body.git.clone + " " + (workspaceDirname + "/" + req.body.name), function(){
                        n();
                    });
                }
                else{
                    n();
                }
            }, function(n){//Make dir!
                socket.emit("stdout", req.body.terminal, "Creating directory...");
                /*if(!req.body.git.clone){
                    socket.emit("stdout", req.body.terminal, "Creating directory...");

                    fs.stat(workspaceDirname + "/" + req.body.name, function(err, stats){
                        if(stats){
                            if(stats.isDirectory()){
                                socket.emit("terminal:stderr", req.body.terminal, _this.i18n.__("Error trying to create workspace, there is already a directory with the same name"));
                                res.send("error");
                            }
                            else{
                                mkdirp(workspaceDirname + "/" + req.body.name, function (err) { 
                                    socket.emit("terminal:stdout", req.body.terminal, _this.i18n.__("Directory created successfully!"));
                                    n();
                                });
                            }
                        }
                        else{
                            mkdirp(workspaceDirname + "/" + req.body.name, function (err) { 
                                socket.emit("terminal:stdout", req.body.terminal, _this.i18n.__("Directory created successfully!"));
                                n();
                            });
                        }
                    });
                }
                else{
                    n();
                }*/
            }, function(n){//Make Dockerfile
                socket.emit("terminal:stdout", req.body.terminal, _this.i18n.__("Preparing the Dockerfile..."));
                let runner = _this.run.getRunner(req.body.container.image);
                
                if(runner){
                    var Dockerfile = _this.run.getDockerFile(runner.dockerfile);
                    Dockerfile = Dockerfile.replace("@version", req.body.container.version);
                    fs.writeFileSync(workspaceDirname + "/" + req.body.name + "/Dockerfile", Dockerfile);
                    
                    
                    var dockerComposer = {version: "3", services: {}};
                    dockerComposer.services[req.body.name] = runner.script;
                    
                    for(let key in req.body.ports){
                        if(typeof dockerComposer.services[req.body.name]["ports"] != "object")
                            dockerComposer.services[req.body.name]["ports"] = [];
                        
                        dockerComposer.services[req.body.name]["ports"].push(req.body.ports[key]);
                    }
                    
                    fs.writeFileSync(workspaceDirname + "/" + req.body.name + "/docker-compose.yml", yaml.safeDump(dockerComposer));
                    
                    //Build docker
                    var execDockerCompose = exec("docker-compose up -d --build --force-recreate", { cwd: workspaceDirname + "/" + req.body.name });
                    execDockerCompose.stdout.on('data', (data) => { socket.emit("terminal:stdout", req.body.terminal, data.toString()); });
                    execDockerCompose.stderr.on('data', (data) => { socket.emit("terminal:stderr", req.body.terminal, data.toString()); });
                    execDockerCompose.on('exit', () => { n(); });
                }
                else{
                    socket.emit("terminal:stderr", req.body.terminal, _this.i18n.__("Could not find the selected container image"));
                    res.send("error");
                }
            }], function(){//Finish
                socket.emit("terminal:stdout", req.body.terminal, _this.i18n.__("Workspace created successfully!"));
                //socket.emit("cwd", {cwd: "/" + req.body.name, _id: req.body.terminal});
                socket.emit("workspace:refresh");
                res.send("ok");
            });
        }        
    });
       
    //New File
    _this.commands.addCommand({
        name: "newfile",
        bind: {mac: "Command-N", win: "Alt-N"},
        event: "webide.windowRemote('/window/newfile', {width: 1000, height: 650})"
    });
    
    _this.navbar.addItem("File/New File...", {command: "newfile", divide: true}, 200);
    
    //Open
    _this.commands.addCommand({
        name: "open",
        bind: {mac: "Command-E", win: "Ctrl-E"},
        event: "webide.windowRemote('/window/open', {'width': 1000, 'height': 550})"
    });
    
    _this.navbar.addItem("File/Open...", {command: "open"}, 300);
    _this.commands.addCommand({name: "openrecent"});
    
    _this.navbar.addItem("File/Open Recent", {
        command: "openrecent",
        class: "wi-openrecent",
        submenu: true,
        divide: true
    }, 400);
    
    //Save
    _this.commands.addCommand({
        name: "file:save",
        bind: {mac: "Command-S", win: "Ctrl-S"},
        route: {method: "PUT", pattern: "/save", middleware: [multipart()]},
        exec: (req, res) => {
            res.send('ok');
        }
    });
    
    _this.navbar.addItem("File/Save", {command: "file:save"}, 400);
    
    //Save As
    _this.commands.addCommand({
        name: "file:saveas",
        bind: {mac: "Command-Shift-S", win: "Ctrl-Shift-S"}
    });
    
    _this.navbar.addItem("File/Save As...", {command: "file:saveas"}, 500);
    
    //Save All
    _this.navbar.addItem("File/Save All", {command: "file:saveall", divide: true}, 600);
    
    //Upload local files
    _this.navbar.addItem("File/Upload Local Files...", {command: "file:uploadlocalfiles"}, 700);
    _this.navbar.addItem("File/Download Project...", {command: "file:downloadproject", divide: true}, 800);
    
    //Close 
    _this.commands.addCommand({
        name: "file:closefile",
        bind: {mac: "Option-W", win: "Alt-W"}
    });
    
    _this.commands.addCommand({
        name: "file:closeallfiles",
        bind: {mac: "Option-Shift-W", win: "Alt-W"}
    });
    
    _this.navbar.addItem("File/Close File", {command: "file:closefile"}, 900);
    _this.navbar.addItem("File/Close All Files", {command: "file:closeallfiles"}, 1000);
    
    //Workspace
    _this.sidebar.addItem("workspace", {
        position: "left",
        display: "Workspace",
        panel: fs.readFileSync(__dirname + "/workspace.ejs")
    });
        
    _this.app.get("/workspace", (req, res) => { 
        let _id = (req.user) ? req.user._id : 0;
        var dirname = fs.realpathSync(__dirname + "/../../.workspaces/" + _id);
        var dirnameSub = (req.query.key) ? decodeURI(req.query.key) : "";
        
        if(/^.*?\.workspaces[\\|\/][0-9][\\|\/].*?[\\|\/].*?$/i.test(dirname + dirnameSub + "/")){
            var projectName = (dirname + dirnameSub + "/").match(/^.*?\.workspaces[\\|\/][0-9][\\|\/](.*?)[\\|\/].*?$/i)[1];
            var dirnameProject =(projectName) ? (dirname + "/" + projectName) : dirname;
        }
         
        glob(dirname + dirnameSub + "/*", {stat: false, cache: false, dot: true}, function (er, files) {
            let source = [];
            var progress = [];           
            
            try{ var projectGit = fs.statSync(dirnameProject + "/.git").isDirectory(); } catch(e) { var projectGit = false; }
            
            if(projectGit){
                progress.push(1);
                
                git.Repository.open(dirnameProject + "/.git").then(function(repo) {
                    for(let keyDiretory in files){
                        let stats = fs.statSync(files[keyDiretory]);
                        try{ var statsDockerfile = fs.statSync(files[keyDiretory] + "/Dockerfile"); } catch(e) { var statsDockerfile = null; }
                        try{ var statsGit = fs.statSync(files[keyDiretory] + "/.git"); } catch(e) { var statsGit = null; }

                        if(statsDockerfile){
                            progress.push(1);
                            var docker = DockerCompose({cwd: files[keyDiretory]});

                            docker.ps(function(listcontainers){
                                try{ var state = listcontainers[0].state } catch(e) { var state = null; }
                                var serviceName = path.basename(files[keyDiretory]);

                                source.push({title: path.basename(files[keyDiretory]), serviceName: serviceName, key: files[keyDiretory].replace(/\\/img, "/").replace(dirname.replace(/\\/img, "/"), ""), type: "container", icon: "fa fa-circle", extraClasses: ((state == "Up") ? "wi-treeview-container-up" : "wi-treeview-container-down"), folder: true, lazy: true});
                                progress.pop();
                            });
                        }
                        else if(statsGit){
                            source.push({title: path.basename(files[keyDiretory]), key: files[keyDiretory].replace(/\\/img, "/").replace(dirname.replace(/\\/img, "/"), ""), type: "git", icon: "fa fa-git", folder: true, lazy: true});
                        }
                        else if(stats.isDirectory()){
                            let gitStatus = git.Status.file(repo, files[keyDiretory].replace(/\\/img, "/").replace(dirnameProject.replace(/\\/img, "/") + "/", ""));
                            
                            switch(gitStatus){
                                case 0: var gitStatusClass = "git-current"; break;
                                case 1: case 128: var gitStatusClass = "git-new"; break;
                                case 2: case 256: var gitStatusClass = "git-modified"; break;
                                case 4: case 512: var gitStatusClass = "git-deleted"; break;
                                case 8: case 2048: var gitStatusClass = "git-renamed"; break;
                                case 16: case 1024: var gitStatusClass = "git-typechange"; break;
                                case 16384: var gitStatusClass = "git-ignored"; break;
                                case 32768: var gitStatusClass = "git-conflicted"; break;
                            }
                                
                            source.push({title: path.basename(files[keyDiretory]), extraClasses: gitStatusClass, gitStatus: gitStatus, key: files[keyDiretory].replace(/\\/img, "/").replace(dirname.replace(/\\/img, "/"), ""), type: "folder", folder: true, lazy: true});
                        }
                    }
            
                    for(let keyFile in files){
                        try{
                            if(fs.statSync(files[keyFile]).isFile()){
                                let mime = require('mime-types');
                                //let gitIndex = statusToText(files[keyFile]);
                                let gitStatus = git.Status.file(repo, files[keyFile].replace(/\\/img, "/").replace(dirnameProject.replace(/\\/img, "/") + "/", ""));
                                
                                switch(gitStatus){
                                    case 0: var gitStatusClass = "git-current"; break;
                                    case 1: case 128: var gitStatusClass = "git-new"; break;
                                    case 2: case 256: var gitStatusClass = "git-modified"; break;
                                    case 4: case 512: var gitStatusClass = "git-deleted"; break;
                                    case 8: case 2048: var gitStatusClass = "git-renamed"; break;
                                    case 16: case 1024: var gitStatusClass = "git-typechange"; break;
                                    case 16384: var gitStatusClass = "git-ignored"; break;
                                    case 32768: var gitStatusClass = "git-conflicted"; break;
                                }
                                
                                source.push({title: path.basename(files[keyFile]), extraClasses: gitStatusClass, gitStatus: gitStatus, type: "file", mime: mime.lookup(files[keyFile]), key: files[keyFile].replace(/\\/img, "/").replace(dirname.replace(/\\/img, "/"), ""), folder: false});
                            }   
                        } catch(e) { console.log(e.message); }
                    }    
                    
                    progress.pop();
                });
            }
            else{      
                for(let keyDiretory in files){
                    let stats = fs.statSync(files[keyDiretory]);
                    try{ var statsDockerfile = fs.statSync(files[keyDiretory] + "/Dockerfile"); } catch(e) { var statsDockerfile = null; }
                    try{ var statsGit = fs.statSync(files[keyDiretory] + "/.git"); } catch(e) { var statsGit = null; }

                    if(statsDockerfile){
                        progress.push(1);
                        var docker = DockerCompose({cwd: files[keyDiretory]});

                        docker.ps(function(listcontainers){
                            try{ var state = listcontainers[0].state } catch(e) { var state = null; }
                            var serviceName = path.basename(files[keyDiretory]);

                            source.push({title: path.basename(files[keyDiretory]), serviceName: serviceName, key: files[keyDiretory].replace(/\\/img, "/").replace(dirname.replace(/\\/img, "/"), ""), type: "container", icon: "fa fa-circle", extraClasses: ((state == "Up") ? "wi-treeview-container-up" : "wi-treeview-container-down"), folder: true, lazy: true});
                            progress.pop();
                        });
                    }
                    else if(statsGit){
                        source.push({title: path.basename(files[keyDiretory]), key: files[keyDiretory].replace(/\\/img, "/").replace(dirname.replace(/\\/img, "/"), ""), type: "git", icon: "fa fa-git", folder: true, lazy: true});
                    }
                    else if(stats.isDirectory()){
                        source.push({title: path.basename(files[keyDiretory]), key: files[keyDiretory].replace(/\\/img, "/").replace(dirname.replace(/\\/img, "/"), ""), type: "folder", folder: true, lazy: true});
                    }
                }
                    
                for(let keyFile in files){
                    try{
                        if(fs.statSync(files[keyFile]).isFile()){
                            let mime = require('mime-types');
                            source.push({title: path.basename(files[keyFile]), type: "file", mime: mime.lookup(files[keyFile]), key: files[keyFile].replace(/\\/img, "/").replace(dirname.replace(/\\/img, "/"), ""), folder: false});
                        }
                    } catch(e) { console.log(e.message); }
                } 
            }   

            
            var persistent = setInterval(function(){
                if(progress.length <= 0){
                    clearInterval(persistent);
                    res.set({"Cache-Control": "public, max-age=0", "Expires": new Date(Date.now() - 300000).toUTCString()}).send(source);
                }
            }, 300);            
        });
    });
    
    _this.app.get("/open", (req, res) => { 
        let _id = (req.user) ? req.user._id : 0,
            dirname = fs.realpathSync(__dirname + "/../../.workspaces/" + _id),        
            filename = fs.realpathSync(dirname + "/" + decodeURIComponent((req.query.filename + '').replace(/%(?![\da-f]{2})/gi, function () {return '%25'}).replace(/\+/g, '%20')));
            
        if(/^.*?\.workspaces[\\|\/][0-9][\\|\/].*?[\\|\/].*?$/i.test(filename)){
            var projectName = (filename).match(/^.*?\.workspaces[\\|\/][0-9][\\|\/](.*?)[\\|\/].*?$/i)[1];
            var dirnameProject = (projectName) ? (dirname + "/" + projectName) : dirname;
        }
                
        try{ var projectGit = fs.statSync(dirnameProject + "/.git").isDirectory(); } catch(e) { var projectGit = false; }
        
        if(projectGit){
            git.Repository.open(dirnameProject + "/.git").then(function(repo) {
                let gitStatus = git.Status.file(repo, filename.replace(/\\/img, "/").replace(dirnameProject.replace(/\\/img, "/") + "/", ""));
                
                if(gitStatus == 256 || gitStatus == 2){
                    repo.getHeadCommit().then(function(commit) {
                        
                    });
                }
                
                fs.stat(filename, function(err, stat){
                    if(err) res.status(500).send(err);
                    else res.send({filename: filename.replace(/\\/img, "/").replace(dirname.replace(/\\/img, "/"), ""), basename: path.basename(filename), mime: mime.lookup(filename), stat: stat});
                }); 
            });
        }
        else{
            fs.stat(filename, function(err, stat){
                if(err) res.status(500).send(err);
                else res.send({filename: filename.replace(/\\/img, "/").replace(dirname.replace(/\\/img, "/"), ""), basename: path.basename(filename), mime: mime.lookup(filename), stat: stat});
            });   
        }        
    });
    
    _this.app.get("/data", (req, res) => {        
        let _id = (req.user) ? req.user._id : 0,
            dirname = fs.realpathSync(__dirname + "/../../.workspaces/" + _id),        
            filename = fs.realpathSync(dirname + "/" + decodeURIComponent((req.query.filename + '').replace(/%(?![\da-f]{2})/gi, function () {return '%25'}).replace(/\+/g, '%20')));
            
        var mimeFile = mime.lookup(filename);
            
        if(!mimeFile)
            mimeFile = "text/plain";        
        
        res.sendFile(filename, {dotfiles: "allow", headers: {"Content-Type": mimeFile}});
    });
    
    _this.app.get("/stream", (req, res) => {        
        let lines = "",
            _id = (req.user) ? req.user._id : 0,
            dirname = fs.realpathSync(__dirname + "/../../.workspaces/" + _id),       
            filename = fs.realpathSync(dirname + "/" + decodeURIComponent((req.query.filename + '').replace(/%(?![\da-f]{2})/gi, function () {return '%25'}).replace(/\+/g, '%20'))); 
        
        fs.stat(filename, function(err, stats){
            res.status(200).set({
                'Content-Type': mime.lookup(filename),
                'Content-disposition': 'attachment;filename=' + filename,
                'File-size': stats.size
            });

            fs.createReadStream(filename).pipe(es.split()).pipe(es.mapSync(function(line){ 
                lines += line + "\n";
            }).on('end', function () {  
                lines = lines.substr(lines, lines.length-2);
                res.send(new Buffer(lines, 'binary')); 
            }));
        });
    });
    
    _this.app.get("/download", (req, res) => {        
        let _id = (req.user) ? req.user._id : 0,
            dirname = fs.realpathSync(__dirname + "/../../.workspaces/" + _id),        
            filename = fs.realpathSync(dirname + "/" + decodeURIComponent((req.query.filename + '').replace(/%(?![\da-f]{2})/gi, function () {return '%25'}).replace(/\+/g, '%20')));
            
        if(fs.statSync(filename).isFile()){
            var mimetype = mime.lookup(filename);

            res.setHeader('Content-disposition', 'attachment; filename=' + path.basename(filename));
            res.setHeader('Content-type', mimetype);

            var filestream = fs.createReadStream(filename);
            filestream.pipe(res);
        }
        else{        
            res.setHeader('Content-disposition', 'attachment; filename=' + path.basename(filename, path.extname(filename)) + ".tar.gz");
            res.setHeader('Content-type', "application/tar+gzip");        
            targz().createReadStream(filename).pipe(res);
        }
    });
    
    _this.app.post("/save", multipart(), (req, res) => {        
        if(typeof req.files.file == "object"){
            let _id = (req.user) ? req.user._id : 0,
                dirname = fs.realpathSync(__dirname + "/../../.workspaces/" + _id);
        
            var inp = fs.createReadStream(req.files.file.path),
                out = fs.createWriteStream(dirname + req.files.file.originalFilename);
        
            inp.pipe(out).on('error', (err) => { 
                res.status(500).send(err);
            }).on('finish', () => {
                res.status(200).send("ok");
            });
        }
        else{
            res.status(500).send("Internal error");
        }
    });
    
    _this.app.get("/js-yaml.min.js", (req, res) => { res.send(fs.readFileSync(__dirname + "/node_modules/js-yaml/dist/js-yaml.min.js").toString()); });
    _this.app.get("/docker-compose-editor", (req, res) => { res.render(__dirname + "/dockercompose.editor.ejs"); });
};