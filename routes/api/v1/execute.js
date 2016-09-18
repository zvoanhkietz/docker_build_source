var express = require('express');
var express = require('express');
var router = express.Router();
var docker = require('./docker');

/* GET home page. */
router.post('/', (req, res, next) => {
	var data = {
		"lang": req.body.language,
		"source": req.body.source,
		"cases":  [
		   {"input": 100, "output": 200},
		   {"input": 200, "output": 300}
		]
	};
	docker.build(data);
	res.json({'status': 'OK'});
});

/**
 * Event
 */
docker.on('execDone', (d)=>{

});

docker.on('upTask', (d)=>{

});

docker.on('downTask', (d)=>{

});

docker.on('busy', ()=>{

});

module.exports = router;
