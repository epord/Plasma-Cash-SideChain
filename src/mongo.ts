let debug	    = require('debug')('app:mongo'),
    mongoose	= require('mongoose'),
    Q			= require('q');

debug('setting up mongo');


mongoose.Promise = Q.Promise;

const gracefulExit = function() {
	mongoose.connection.close(function() {
		debug('Mongoose default connection with DB is disconnected through app termination');
		process.exit(0);
	});
};

// If the Node process ends, close the Mongoose connection
process.on('SIGINT', gracefulExit).on('SIGTERM', gracefulExit);

//TODO: Ver tipo de cb, me lo autogeneró
export function init(cb: { (): void; (arg0: any): void; }) {
	mongoose.connection.on('connected', () => {
		debug('Connected to DB!');
		cb();
	});


	// If the connection throws an error
	mongoose.connection.on('error', (err: { message: any; }) => {
		debug('Failed to connect to DB on startup ', err.message);
		console.error(err);
		cb(err);
	});

	// When the connection is disconnected
	mongoose.connection.on('disconnected', () => {
		debug('Mongoose default connection to DB disconnected');
		// process.exit(0);
	});

	debug('connecting to mongo');

	mongoose.connect(`mongodb://${process.env.MONGO_URL}:${process.env.MONGO_PORT}/${process.env.MONGO_DB_NAME}`, {useNewUrlParser: true});

	debug(`Trying to connect to MongoDB`);
}