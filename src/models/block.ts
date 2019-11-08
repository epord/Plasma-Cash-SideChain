import BigNumber from "bignumber.js";
import {Document, Schema} from "mongoose";
import {ITransaction} from "./transaction";

const BigNumberSchema = require('mongoose-bignumber');

export interface IBlock extends Document {
	block_number: BigNumber;

	root_hash: string;

	timestamp: Date;

	transactions: Array<string>;
	Transactions: Array<ITransaction>;
}

const BlockSchema: Schema = new Schema({

	_id: {
		type: BigNumberSchema,
		scale: 0,
		required: true,
		min: '0'
	},

	root_hash: String,

	timestamp: {
		type: Date,
		default: Date.now
	},

	transactions: [{
		type: String,
		ref: 'Transaction'
	}]

});
// @ts-ignore
BlockSchema.virtual('block_number').get(function() { return this._id });
// @ts-ignore
BlockSchema.virtual('Transactions').get(function() { return this.transactions});
export default BlockSchema;