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
    DockerCompose = require("docker-compose-remote-api"),
    mime = require('mime-types'),
    git = require("nodegit"); 

module.exports = (_this) => {  
    //Workspace
    _this.sidebar.addItem("workspace", {
        position: "left",
        display: "Workspace",
        panel: fs.readFileSync(__dirname + "/workspace.ejs")
    }, 100);
        
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
                                
                                source.push({title: path.basename(files[keyFile]), tooltip: files[keyFile].replace(dirname, ""), extraClasses: gitStatusClass, gitStatus: gitStatus, type: "file", mime: mime.lookup(files[keyFile]), key: files[keyFile].replace(/\\/img, "/").replace(dirname.replace(/\\/img, "/"), ""), folder: false});
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
}
