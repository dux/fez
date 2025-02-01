(()=>{function t(){return{name:"fez-plugin",transform(n,o){let e=o.split("/").pop().split(".");if(e[1]=="fez")return{code:`Fez.compile('${e[0]}', \`${n}\`)`,map:null}}}}var f=t;})();
//# sourceMappingURL=rollup.js.map
