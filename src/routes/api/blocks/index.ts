import {Utils} from "../../../utils/Utils";
import {depositBlock, mineBlock} from "../../../services/block";
import {BlockService, SecretRevealingBlockService} from "../../../services";
import * as Status from 'http-status-codes'
import * as express from 'express';
import {NativeError} from "mongoose";
import {IBlock} from "../../../models/block";
import {ISRBlock} from "../../../models/secretRevealingBlock";
import BigNumber from "bignumber.js";

const router = express.Router({mergeParams: true})
    , debug = require('debug')('app:api:blocks');

debug('registering /api/blocks routes');

router.get('/:block_number([0-9]+)', (req: express.Request, res: express.Response) => {
    BlockService
        .findById(req.params.block_number)
        .populate("transactions")
        .exec((err: NativeError, block: IBlock) => {
            if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
            res.status(Status.OK).json(Utils.blockToJson(block));
        })
});

router.get('/secret-block/:block_number([0-9]+)', (req: express.Request, res: express.Response) => {
    SecretRevealingBlockService
        .findById(req.params.block_number)
        .populate("transactions")
        .exec((err: NativeError, block: ISRBlock) => {
            if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
            res.status(Status.OK).json(Utils.secretBlockToJson(block));
        })
});

router.get('/', (req: express.Request, res: express.Response) => {
    BlockService
        .find({})
        .populate("transactions")
        .exec((err: NativeError, blocks: IBlock[]) => {
            if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
            res.status(Status.OK).json(blocks.map(Utils.blockToJson));
        })
});

router.post('/mine', (req: express.Request, res: express.Response) => {
    mineBlock(Utils.responseWithStatus(res, Utils.blockToJson));
});

/**
 * Deposit a Token
 * {
 *  "slot": int|string,
 *  "blockNumber": int|string,
 *  "owner": string (hex),
 * }
 */
router.post('/deposit', (req: express.Request, res: express.Response, next) => {
    const {slot, blockNumber, owner} = req.body;

    if (slot == undefined || !owner || blockNumber == undefined) {
        return res.status(Status.BAD_REQUEST).json('Missing parameter');
    }

    const slotBN = new BigNumber(slot);
    if (slotBN.isNaN()) {
        return res.status(Status.BAD_REQUEST).json('Invalid slot');
    }

    const blockNumberBN = new BigNumber(blockNumber);
    if (blockNumberBN.isNaN()) {
        return res.status(Status.BAD_REQUEST).json('Invalid blockNumber');
    }

    depositBlock(slotBN, blockNumberBN, owner, Utils.responseWithStatus(res, Utils.blockToJson));
});

export default router;