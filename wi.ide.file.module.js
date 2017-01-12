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

let multipart = require('connect-multiparty'),
    fs = require("fs"); 

module.exports = (_this) => {         
    //New Project
    _this.commands.addCommand({
        name: "newproject",
        bind: {mac: "Command-N", win: "Ctrl-Shift-N"},
    });
    
    _this.navbar.addItem("File/New Project...", {
        command: "newproject",
        onclick: "webide.window('/window/newproject')"
    }, 100);
    
    //New File
    _this.commands.addCommand({
        name: "newfile",
        bind: {mac: "Command-N", win: "Alt-N"}
    });
    
    _this.navbar.addItem("File/New File...", {
        command: "newfile",
        onclick: "webide.window('/window/newfile')",
        divide: true
    }, 200);
    
    //Open
    _this.commands.addCommand({
        name: "open",
        bind: {mac: "Command-E", win: "Ctrl-E"}
    });
    
    _this.navbar.addItem("File/Open...", {
        command: "open",
        onclick: "webide.windowRemote('/window/open', {'width': 1000, 'height': 550})"
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
    
    _this.panelsbar.addItem("navigate", {
        position: "left",
        display: "Navigate",
        panel: fs.readFileSync(__dirname + "/wi.ide.navigate.ejs")
    })
};