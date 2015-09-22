var express = require('express'),
    app = express(),
    router = express.Router();

router.route('/')
  .get(function(req, res){
    res.status(200);
});

router.route('/dailydata')
  .get(function(req, res){
    fs.readFile(tasksList, 'utf8', function (err,data) {
      if (err) {
        return console.log(err);
      }

      console.log('Reading tasks file...');
      res.status(200).json(data);
    });
});

module.exports = router;