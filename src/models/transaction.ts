import BigNumber from "bignumber.js";
import {Document, Schema} from "mongoose";
import {ITransaction} from "./transaction";
import {IBlock} from "./block";
import CoinStateSchema from "./coinStateModel";

const BigNumberSchema = require('mongoose-bignumber');

export interface ITransaction extends Document {
	/**
	 * Hash of the transaction
	 */
	hash: string;

	slot: BigNumber;

	owner: string;

	recipient: string;

	/**
	 * Last block that spend the slot
	 * If (block_spent % childBlockInterval) == 0 then block_spent is a deposit block
	 */
	block_spent: BigNumber;

	/**
	 * Block which includes this transaction
	 */
	mined_block: BigNumber;
	Mined_Block: IBlock;

	mined_timestamp: Date;
	timestamp: Date;

	signature?: string;

	is_swap: boolean;
	secret?: string;
	swapping_slot: BigNumber;
	hash_secret: string;
	invalidated: boolean;
}

export interface ISingleSwapData {
	data: ITransaction
	firstInclusionProof?: string
	secretProof?: string
}



const TransactionSchema: Schema = new Schema({

	slot:  {
		type: BigNumberSchema,
		scale: 0,
		required: true,
		min: '0'
	},

	owner: String,

	recipient: String,

	// hash
	_id: String,

	// Last block that spend slot
	// If (block_spent % childBlockInterval) == 0 then block_spent is a deposit block
	block_spent:  {
		type: BigNumberSchema,
		scale: 0,
		required: true,
		min: '0'
	},

	// Block which includes this transaction
	mined_block: {
		type: BigNumberSchema,
		ref: 'Block'
	},

	mined_timestamp: Date,

	timestamp: {
		type: Date,
		default: Date.now
	},

	signature: String,

	is_swap: {
		type: Boolean,
		default: false
	},

	swapping_slot:  {
		type: BigNumberSchema,
		scale: 0,
		min: '0',
	},

	hash_secret: String,
	secret: String,
	invalidated:  {
		type: Boolean,
		default: false
	}

});
// @ts-ignore
TransactionSchema.virtual('hash').get(function() { return this._id });
// @ts-ignore
TransactionSchema.virtual('Mined_Block').get(function() { return this.mined_block });
export default TransactionSchema;
