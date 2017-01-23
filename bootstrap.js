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
    multipart = require('connect-multiparty'),
    es = require("event-stream"),
    mkdirp = require("mkdirp"),
    async = require("async"),
    exec = require('child_process').exec,
    yaml = require('js-yaml'),
    DockerCompose = require("docker-compose-remote-api"),
    mime = require('mime-types'),
    git = require("nodegit"),
    
    promisify = require('promisify'); 
    
/*var promisify_Repository = promisify.object({
    open: promisify.cb_func(),
    then: promisify.cb_func()
});

let Repository = promisify_Repository(git.Repository);*/

module.exports = (_this) => {  
    _this.insertJs(__dirname + "/node_modules/marked/lib/marked.js");
    _this.insertJs(__dirname + "/diff_match_patch.js");
    
    //New Project
    _this.commands.addCommand({
        name: "webide:newproject",
        bind: {mac: "Command-N", win: "Ctrl-Shift-N"}
    });
    
    _this.navbar.addItem("File/New Project...", {
        command: "webide:newproject"
    }, 100);
    
    _this.app.get("/window/newproject", (req, res) => { res.render(__dirname + "/newproject.ejs", {projects: _this.run.getRunners()}); });
    _this.app.post("/window/newproject", (req, res) => { 
        let _id = (req.user) ? req.user._id : 0;
        let socket = _this._.getSocket(req.body.socket);
        let workspaceDirname = fs.realpathSync(__dirname + "/../../.workspaces/" + _id);
        
        if(socket){
            socket.emit("stdout", {out: "Starting workspace creation...", _id: req.body.terminal});
               
            async.series([function(n){//Clone github
                if(req.body.git.clone){
                    socket.emit("stdout", {out: "git clone " + req.body.git.clone, _id: req.body.terminal});
                    
                    var execGitClone = exec("git clone " + req.body.git.clone + " " + (workspaceDirname + "/" + req.body.name), { cwd: workspaceDirname });
                    execGitClone.stdout.on('data', (data) => {  socket.emit("stdout", {out: data.toString(), _id: req.body.terminal}); });
                    execGitClone.stderr.on('data', (data) => {  socket.emit("stderr", {out: data.toString(), _id: req.body.terminal}); });
                    execGitClone.on('exit', () => {
                        n();
                    });
                }
                else{
                    n();
                }
            }, function(n){//Make dir!
                if(!req.body.git.clone){
                    socket.emit("stdout", {out: "Creating directory...", _id: req.body.terminal});

                    fs.stat(workspaceDirname + "/" + req.body.name, function(err, stats){
                        if(stats){
                            if(stats.isDirectory()){
                                socket.emit("stderr", {out: _this.i18n.__("Error trying to create workspace, there is already a directory with the same name"), _id: req.body.terminal});
                                res.send("error");
                            }
                            else{
                                mkdirp(workspaceDirname + "/" + req.body.name, function (err) { 
                                    socket.emit("stdout", {out: _this.i18n.__("Directory created successfully!"), _id: req.body.terminal});
                                    n();
                                });
                            }
                        }
                        else{
                            mkdirp(workspaceDirname + "/" + req.body.name, function (err) { 
                                socket.emit("stdout", {out: _this.i18n.__("Directory created successfully!"), _id: req.body.terminal});
                                n();
                            });
                        }
                    });
                }
                else{
                    n();
                }
            }, function(n){//Make Dockerfile
                socket.emit("stdout", {out: _this.i18n.__("Preparing the Dockerfile..."), _id: req.body.terminal});
                let runner = _this.run.getRunner(req.body.container.image);
                
                if(runner){
                    var Dockerfile = _this.run.getDockerFile(runner.dockerfile);
                    Dockerfile = Dockerfile.replace("@version", req.body.container.version);
                    fs.writeFileSync(workspaceDirname + "/" + req.body.name + "/Dockerfile", Dockerfile);
                    
                    
                    var dockerComposer = {version: "3", services: {}};
                    dockerComposer.services[req.body.name] = runner.script;
                    fs.writeFileSync(workspaceDirname + "/" + req.body.name + "/docker-compose.yml", yaml.safeDump(dockerComposer));
                    
                    //Build docker
                    var execDockerCompose = exec("docker-compose up -d --build --force-recreate", { cwd: workspaceDirname + "/" + req.body.name });
                    execDockerCompose.stdout.on('data', (data) => { socket.emit("stdout", {out: data.toString(), _id: req.body.terminal}); });
                    execDockerCompose.stderr.on('data', (data) => { socket.emit("stderr", {out: data.toString(), _id: req.body.terminal}); });
                    execDockerCompose.on('exit', () => {
                        n();
                    });
                }
                else{
                    socket.emit("stderr", {out: _this.i18n.__("Could not find the selected container image"), _id: req.body.terminal});
                    res.send("error");
                }
            }], function(){//Finish
                socket.emit("stdout", {out: _this.i18n.__("Workspace created successfully!"), _id: req.body.terminal});
                socket.emit("cwd", {cwd: "/" + req.body.name, _id: req.body.terminal});
                socket.emit("workspace:refresh");
                socket.emit("enable", {_id: req.body.terminal});
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
    
    _this.navbar.addItem("File/New File...", {
        command: "newfile",
        divide: true
    }, 200);
    
    //Open
    _this.commands.addCommand({
        name: "open",
        bind: {mac: "Command-E", win: "Ctrl-E"},
        event: "webide.windowRemote('/window/open', {'width': 1000, 'height': 550})"
    });
    
    _this.navbar.addItem("File/Open...", {
        command: "open"
    }, 300);
    
    //Open
    _this.commands.addCommand({
        name: "openrecent"
    });
    
    _this.navbar.addItem("File/Open Recent", {
        command: "openrecent",
        class: "wi-openrecent",
        submenu: true,
        divide: true
    }, 400);
    
    //Adding command
    _this.commands.addCommand({
        name: "save",
        bind: {mac: "Command-S", win: "Ctrl-S"},
        route: {method: "PUT", pattern: "/save", middleware: [multipart()]},
        exec: (req, res) => {
            res.send('ok');
        }
    });
    
    //Adding menu
    _this.navbar.addItem("File/Save", {
        command: "save"
    }, 700);
    
    //Panels
    _this.sidebar.addItem("workspace", {
        position: "left",
        display: "Workspace",
        panel: fs.readFileSync(__dirname + "/workspace.ejs")
    });
        
    //Workspace
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
                console.log(gitStatus);
                
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
        
        res.sendFile(filename, {
            dotfiles: "allow",
            headers: {
                "Content-Type": mimeFile
            }
        });
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
    
    _this.app.get("/js-yaml.min.js", (req, res) => { res.send(fs.readFileSync(__dirname + "/node_modules/js-yaml/dist/js-yaml.min.js").toString()); });
    _this.app.get("/docker-compose-editor", (req, res) => { res.render(__dirname + "/dockercompose.editor.ejs"); });
};