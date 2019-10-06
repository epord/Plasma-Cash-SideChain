import BigNumber from "bignumber.js";
import CoinState, {ICoinState} from "../models/CoinStateModel";

export class CoinStateService {

    public static exitSlot(slot: BigNumber, cb: any) {
        CoinState.findById(slot, (err: Error, coinState: ICoinState) => {
            coinState.state = "EXITING";
            coinState.save();
        });
        CoinState.findOneAndUpdate({
            _id: new BigNumber(slot)
        }, {
            $set: {
                state: 'EXITING'
            }
        }, cb);
    }

    public static resetSlot(slot: BigNumber, cb: any) {
        CoinState.findOneAndUpdate({
            _id: new BigNumber(slot)
        }, {
            $set: {
                state: 'DEPOSITED'
            }
        }, cb);
    }

    public static swapSlot(slot: BigNumber, cb: any) {
        CoinState.findOneAndUpdate({
            _id: new BigNumber(slot)
        }, {
            $set: {
                state: 'SWAPPING'
            }
        }, cb);
    }

    public static endSwap(slot: BigNumber, newOwner: string, cb: any) {
        CoinState.findOneAndUpdate({
            _id: new BigNumber(slot)
        }, {
            $set: {
                state: 'DEPOSITED',
                owner: newOwner.toLowerCase()
            }
        }, cb);
    }

    public static updateOwner(slot: BigNumber, newOwner: string, cb: any) {
        CoinState.findOneAndUpdate({
            _id: new BigNumber(slot)
        }, {
            $set: {
                owner: newOwner.toLowerCase()
            }
        }, cb);
    }

    // TODO: Find out type of exiting
    public static getOwnedTokens(owner: string, exiting: any, cb: any) {
        CoinState.find({ owner: owner.toLowerCase(), state: exiting ? "EXITING" : "DEPOSITED" }).exec( (err: Error, slots: Array<ICoinState>) => {
            if(err) {
                console.error(err)
                return cb(err);
            }
            return cb(null, {statusCode: 200, result: slots.map(s => s._id)});
        });
    }

    //TODO: Change calls to this with the BigNumber instead of the string.
    public static getOwner(token: BigNumber, cb: any) {
        CoinState.findById(token).exec( (err: Error, coin: ICoinState) => {
            if(err) return cb(err);
            return cb(null, coin.owner);
        });
    }
}