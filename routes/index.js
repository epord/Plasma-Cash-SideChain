const express = require('express')
		, router = express.Router({ mergeParams: true })
		, debug = require('debug')('app:api');

module.exports = {
	api: require('./api')
}