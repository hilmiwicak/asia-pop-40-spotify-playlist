const { default: fetch } = require("node-fetch");


fetch("http://fakeapi.jsonparseronline.com/posts")
    .then(response => response.json())
    .then(json => console.log(json))