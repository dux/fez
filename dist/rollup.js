(()=>{function t(){return{name:"fez-plugin",transform(e,r){let n=r.split("/").pop().split(".");if(n[1]==="fez")return e=e.replace(/`/g,"\\`").replace(/\$/g,"\\$"),{code:`Fez.compile('${n[0]}', \`
${e}\`)`,map:null}}}}var l=t;})();
//# sourceMappingURL=rollup.js.map
