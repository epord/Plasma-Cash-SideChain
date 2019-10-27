import * as express from 'express';
import Blocks from './blocks'
import Contracts from './contracts'
import Transactions from './transactions'
import Tokens from './tokens'
import Challenges from './challenges'
import Hacks from './hacks'
import Exits from './exits'

const router = express.Router({ mergeParams: true }),
    debug = require('debug')('app:api');

debug('registering /api routes');

router.use((req: express.Request, res: express.Response, next) => {
	debug(`${req.method} ${req.baseUrl}${req.path} %o %o`, req.query || {}, req.body || {});
	next();
});

router.use('/blocks', Blocks);
router.use('/contracts', Contracts);
router.use('/transactions', Transactions);
router.use('/tokens', Tokens);
router.use('/challenges', Challenges);
router.use('/hacks', Hacks);
router.use('/exits', Exits);

export default router;