import {Document, Schema} from "mongoose";
import BigNumber from "bignumber.js";

const BigNumberSchema = require('mongoose-bignumber');

export interface ISRBlock extends Document {
	block_number: BigNumber;
	root_hash: string;
	timestamp: Date;
	is_submitted: boolean,
}


const SecretRevealingBlockSchema: Schema = new Schema({
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

	is_submitted: {
		type: Boolean,
		default: false
	}
});
// @ts-ignore
SecretRevealingBlockSchema.virtual('block_number').get(function() { return this._id });
export default SecretRevealingBlockSchema;
