import BigNumber from "bignumber.js";
import mongoose, {Schema, Document} from "mongoose";

export interface ICoinState extends Document {
    _id: BigNumber;
    state: string;
    owner: string;
}

const CoinStateSchema: Schema = new Schema({
    //TODO: Test if this BigNumber works or we need to go back to BigNumberSchema.
    _id: { type: BigNumber, scale: 0, required: true, min: '0' },
    state: { type: String, enum: ['DEPOSITED', 'EXITING'] },
    owner: String,
});

const CoinState = mongoose.model<ICoinState>('CoinState', CoinStateSchema);
export default CoinState;