import {Utils} from "../utils/Utils";
import {getLastMinedTransaction} from "./transaction";
import {getProof} from "./block";
import {ApiResponse, CallBack} from "../utils/TypeDef";
import BigNumber from "bignumber.js";
import {IJSONChallengeData} from "../routes/api/jsonModels";

export class Challenge {
	public static getAfterData = (slot: BigNumber, exitBlock: BigNumber, cb: CallBack<ApiResponse<IJSONChallengeData>>) => {
		getLastMinedTransaction({slot: slot, block_spent: exitBlock}, (err, transaction) => {

			if (err) return cb(err);
			if (!transaction) return cb({ statusCode: 404, error: 'There is no data for a Challenge After for said transaction' });

			getProof(slot.toString(), transaction.mined_block.toString(), async (err: any, proof?: string) => {
				if (err) return cb(err)
				if (!proof) return cb({ statusCode: 500, error: 'Could not create Proof for the previous transaction' });

				cb(null, {statusCode: 200, result: await Utils.challengeDataToJson(transaction, proof)})
			});
		});
	}

	public static getBeforeData = (slot: BigNumber, parentBlock: BigNumber, cb: CallBack<ApiResponse<IJSONChallengeData>>) => {
		getLastMinedTransaction({ slot, block_spent: { $lte: parentBlock } }, (err, transaction) => {
			if (err) return cb(err);
			if (!transaction) return cb({ statusCode: 404, error: 'There is no data for a Challenge Before for said transaction' });

			getProof(slot.toString(), transaction.mined_block.toString(), async (err: any, proof?: string) => {
				if (err) return cb(err)
				if (!proof) return cb({ statusCode: 500, error: 'Could not create Proof for the previous transaction' });

				cb(null, {statusCode: 200, result: await Utils.challengeDataToJson(transaction, proof)})
			});
		})
	}
}


