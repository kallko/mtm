var express = require('express'),
    app = express(),
    router = express.Router();

router.route('/')
  .get(function(req, res){
    res.status(200);
});

module.exports = router;
