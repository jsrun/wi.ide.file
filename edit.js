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

module.exports = (_this) => {
    //Undo
    _this.commands.addCommand({name: "webide:undo", bind: {mac: "Command-Z", win: "Ctrl-Z"}});
    _this.navbar.addItem("Edit/Undo", {command: "webide:undo", disabled: true}, 200);
    
    //Redo
    _this.commands.addCommand({name: "webide:redo", bind: {mac: "Command-Y", win: "Ctrl-Y"}});
    _this.navbar.addItem("Edit/Redo", {command: "webide:redo", disabled: true, divide: true}, 200);
    
    //Cut
    _this.commands.addCommand({name: "webide:cut", bind: {mac: "Command-X", win: "Ctrl-X"}});
    _this.navbar.addItem("Edit/Cut", {command: "webide:cut", disabled: true}, 200);
    
    //Copy
    _this.commands.addCommand({name: "webide:copy", bind: {mac: "Command-C", win: "Ctrl-C"}});
    _this.navbar.addItem("Edit/Copy", {command: "webide:copy", disabled: true}, 200);
    
    //Paste
    _this.commands.addCommand({name: "webide:paste", bind: {mac: "Command-V", win: "Ctrl-V"}});
    _this.navbar.addItem("Edit/Paste", {command: "webide:paste", disabled: true}, 200);
};

