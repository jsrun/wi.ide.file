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

let glob = require("glob"),
    fs = require("fs"),
    path = require('path'),
    multipart = require('connect-multiparty'); 

module.exports = (_this) => {  
    _this.insertJs(__dirname + "/node_modules/marked/lib/marked.js");
    
    //New Project
    _this.commands.addCommand({
        name: "webide:newproject",
        bind: {mac: "Command-N", win: "Ctrl-Shift-N"},
    });
    
    _this.navbar.addItem("File/New Project...", {
        command: "webide:newproject"
    }, 100);
    
    _this.app.get("/window/newproject", (req, res) => { res.render(__dirname + "/wi.window.newproject.ejs", {projects: JSON.parse(fs.readFileSync(__dirname + "/projects.json"))}); });
    
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
    _this.panelsbar.addItem("workspace", {
        position: "left",
        display: "Workspace",
        panel: fs.readFileSync(__dirname + "/wi.ide.workspace.ejs")
    });
        
    //Workspace
    _this.app.get("/workspace", (req, res) => { 
        let _id = (req.user) ? req.user._id : 0;

        if(req.query.key){
            var dirname = fs.realpathSync(decodeURI(req.query.key));
        }
        else{
            //if(req.user)
                var dirname = fs.realpathSync(__dirname + "/../../.workspaces/" + _id);
            //else
            //    var dirname = fs.realpathSync(__dirname + "/../../");
        }
        
        glob(dirname + "/*", {stat: true, cache: true, nodir: true, dot: true}, function (er, files) {
            let source = [];

            for(let keyDiretory in files){
                let stats = fs.statSync(files[keyDiretory]);

                if(stats.isDirectory())
                    source.push({title: path.basename(files[keyDiretory]), key: files[keyDiretory], folder: true, lazy: true});
            }

            for(let keyFile in files){
                let stats = fs.statSync(files[keyFile]);
                
                if(stats.isFile())
                    source.push({title: path.basename(files[keyFile]), key: files[keyFile], folder: false});
            }

            res.send(source);
        });
    });
    
    _this.app.get("/open", (req, res) => { 
        let mime = require('mime-types');        
        let filename = fs.realpathSync(decodeURIComponent((req.query.filename + '').replace(/%(?![\da-f]{2})/gi, function () {return '%25'}).replace(/\+/g, '%20')));
        
        fs.stat(filename, function(err, stat){
            if(err) res.status(500).send(err);
            else res.send({filename: filename, basename: path.basename(filename), mime: mime.lookup(filename), stat: stat});
        });
    });
    
    _this.app.get("/data", (req, res) => {        
        let mime = require('mime-types'),      
            filename = fs.realpathSync(decodeURIComponent((req.query.filename + '').replace(/%(?![\da-f]{2})/gi, function () {return '%25'}).replace(/\+/g, '%20')));
            
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
};