import BigNumber from "bignumber.js";
import {Document, Schema} from "mongoose";

const BigNumberSchema = require('mongoose-bignumber');

export interface ICoinState extends Document {
    slot: BigNumber;
    state: string;
    owner: string;
}

const CoinStateSchema: Schema = new Schema({
    _id: { type: BigNumberSchema, scale: 0, required: true, min: '0' },
    state: { type: String, enum: ['DEPOSITED', 'EXITING', 'SWAPPING'] },
    owner: String,
});
// @ts-ignore
CoinStateSchema.virtual('slot').get(function() { return this._id});
export default CoinStateSchema;