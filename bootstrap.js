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
    spawn = require('child_process').spawn,
    promisify = require('promisify'),
    multipart = require('connect-multiparty'),
    targz = require('tar.gz'); 

module.exports = (_this, _, i18n, app, commands, navbar, terminal, run, env) => {  
    _this.extend("workspace", require(__dirname + "/workspace.js"));
    _this.extend("edit", require(__dirname + "/edit.js"));
    
    _this.insertJs(__dirname + "/node_modules/marked/lib/marked.js");
    _this.insertJs(__dirname + "/diff_match_patch.js");
    _this.insertJs(__dirname + "/node_modules/clipboard/dist/clipboard.min.js");
    //_this.insertJs(__dirname + "/minimap/dist/minimap.min.js");
    //_this.insertCss(__dirname + "/minimap/dist/minimap.min.css");
    
    navbar.import(__dirname + "/navbar.json");
    commands.import(__dirname + "/commands.json");
    
    navbar.addItem("File/Open Recent", {
        command: "openrecent",
        class: "wi-openrecent",
        submenu: [],
        divide: true
    }, 14);
         
    //Routes
    app.get("/window/newproject", (req, res) => { res.render(__dirname + "/newproject.ejs", {projects: run.getRunners()}); });
    app.post("/window/newproject", (req, res) => { 
        let _id = (req.user) ? req.user._id : 0;
        let socket = _.getSocket(req.body.socket);
        let workspaceDirname = fs.realpathSync(__dirname + "/../../.workspaces/" + _id);
        let term = terminal.get(req.body.termID);
        
        if(socket){
            term.write(i18n.__("Creating workspace..."));
               
            async.series([function(n){//Clone github
                if(req.body.git.clone){         
                    let gitclone = spawn("git", ["clone", req.body.git.clone, "./" + req.body.name], {cwd: workspaceDirname});
                    gitclone.on('close', (code) => { n(); });
                }
                else{
                    n();
                }
            }, function(n){//Make dir!
                if(!req.body.git.clone){
                    fs.stat(workspaceDirname + "/" + req.body.name, function(err, stats){
                        if(stats){
                            if(stats.isDirectory()){
                                term.write(i18n.__("Error trying to create workspace, there is already a directory with the same name"));
                                res.send("error");
                            }
                            else{
                                mkdirp(workspaceDirname + "/" + req.body.name, function (err) { n(); });
                            }
                        }
                        else{
                            mkdirp(workspaceDirname + "/" + req.body.name, function (err) { n(); });
                        }
                    });
                }
                else{
                    n();
                }
            }, function(n){//Make Dockerfile
                let runner = run.getRunner(req.body.container.image);
                
                if(runner){
                    var Dockerfile = run.getDockerFile(runner.dockerfile);
                    Dockerfile = Dockerfile.replace("@version", req.body.container.version);
                    fs.writeFileSync(workspaceDirname + "/" + req.body.name + "/Dockerfile", Dockerfile);
                                        
                    var dockerComposer = {version: "3", services: {}};
                    dockerComposer.services[req.body.name.toLowerCase()] = runner.script;
                    
                    for(let key in req.body.ports){
                        if(typeof dockerComposer.services[req.body.name]["ports"] != "object")
                            dockerComposer.services[req.body.name]["ports"] = [];
                        
                        dockerComposer.services[req.body.name]["ports"].push(req.body.ports[key]);
                    }
                    
                    fs.writeFileSync(workspaceDirname + "/" + req.body.name + "/docker-compose.yml", yaml.safeDump(dockerComposer));
                    n();
                }
                else{
                    term.write(i18n.__("Could not find the selected container image"));
                    res.send("error");
                }
            }], function(){//Finish
                term.write("\n cd " + workspaceDirname + "/" + req.body.name + "\n && clear \n");
                socket.emit("workspace:refresh");
                res.send("ok");
            });
        }        
    });                  
                
    app.get("/open", (req, res) => { 
        let _id = (req.user) ? req.user._id : 0,
            dirname = (env == "dev") ? fs.realpathSync(__dirname + "/../../") : fs.realpathSync(__dirname + "/../../.workspaces/" + _id),        
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
    
    app.get("/data", (req, res) => {        
        let _id = (req.user) ? req.user._id : 0,
            dirname = (env == "dev") ? fs.realpathSync(__dirname + "/../../") : fs.realpathSync(__dirname + "/../../.workspaces/" + _id),
            filename = fs.realpathSync(dirname + "/" + decodeURIComponent((req.query.filename + '').replace(/%(?![\da-f]{2})/gi, function () {return '%25'}).replace(/\+/g, '%20')));
            
        var mimeFile = mime.lookup(filename);
            
        if(!mimeFile)
            mimeFile = "text/plain";        
        
        res.sendFile(filename, {dotfiles: "allow", headers: {"Content-Type": mimeFile}});
    });
    
    app.get("/stream", (req, res) => {        
        let lines = "",
            _id = (req.user) ? req.user._id : 0,
            dirname = (env == "dev") ? fs.realpathSync(__dirname + "/../../") : fs.realpathSync(__dirname + "/../../.workspaces/" + _id),
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
    
    app.get("/download", (req, res) => {        
        let _id = (req.user) ? req.user._id : 0,
            dirname = (env == "dev") ? fs.realpathSync(__dirname + "/../../") : fs.realpathSync(__dirname + "/../../.workspaces/" + _id),
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
    
    app.post("/save", multipart(), (req, res) => {        
        if(typeof req.files.file == "object"){
            let _id = (req.user) ? req.user._id : 0,
                dirname = (env == "dev") ? fs.realpathSync(__dirname + "/../../") : fs.realpathSync(__dirname + "/../../.workspaces/" + _id);
        
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
    
    app.post("/rename", (req, res) => {  
        let _id = (req.user) ? req.user._id : 0,
            dirname = (env == "dev") ? fs.realpathSync(__dirname + "/../../") : fs.realpathSync(__dirname + "/../../.workspaces/" + _id),
            filename = fs.realpathSync(dirname + "/" + decodeURIComponent((req.body.filename + '').replace(/%(?![\da-f]{2})/gi, function () {return '%25'}).replace(/\+/g, '%20')));
            
        try{
            fs.rename(filename, filename.replace(path.basename(filename), req.body.newname), function(err){
                if(err) res.send(err);
                else res.send("ok");
            });
        }
        catch(e){
            res.send(e.message);
        }
    });
    
    app.delete("/delete", (req, res) => {
        let _id = (req.user) ? req.user._id : 0,
            socket = _.getSocket(req.body.socket),
            dirname = (env == "dev") ? fs.realpathSync(__dirname + "/../../") : fs.realpathSync(__dirname + "/../../.workspaces/" + _id),
            filename = fs.realpathSync(dirname + "/" + decodeURIComponent((req.body.filename + '').replace(/%(?![\da-f]{2})/gi, function () {return '%25'}).replace(/\+/g, '%20')));
            
        try{
            if(fs.statSync(filename).isFile()){
                fs.unlink(filename, (err) => {
                    socket.emit("workspace:refresh");
                });
            }
            else if(fs.statSync(filename).isDirectory()){
                
            }
        }catch(e) { console.log(e.message); }
        
        res.send("ok");
    });
    
    app.get("/editor/types", (req, res) => {  
        res.render(__dirname + "/types.ejs", {itens: {
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
        }});
    });
    
    app.get("/js-yaml.min.js", (req, res) => { res.send(fs.readFileSync(__dirname + "/node_modules/js-yaml/dist/js-yaml.min.js").toString()); });
    app.get("/docker-compose-editor", (req, res) => { res.render(__dirname + "/dockercompose.editor.ejs"); });
};