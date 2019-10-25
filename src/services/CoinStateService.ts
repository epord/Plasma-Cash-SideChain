import BigNumber from "bignumber.js";
import CoinState, {ICoinState} from "../models/CoinStateModel";

export class CoinStateService {

    public static findBySlot(slot: BigNumber, cb: any) {
        CoinState.findOne({slot: slot}).exec( (err: Error, coinState: ICoinState) => {
            if(err) return cb(err);
            return cb(null, coinState);
        });
    }

    public static exitSlot(slot: BigNumber, cb: any) {
        CoinState.findOneAndUpdate({
            slot: new BigNumber(slot)
        }, {
            $set: {
                state: 'EXITING'
            }
        }, cb);
    }

    public static resetSlot(slot: BigNumber, cb: any) {
        CoinState.findOneAndUpdate({
            slot: new BigNumber(slot)
        }, {
            $set: {
                state: 'DEPOSITED'
            }
        }, cb);
    }

    public static swapSlot(slot: BigNumber, cb: any) {
        CoinState.findOneAndUpdate({
            slot: new BigNumber(slot)
        }, {
            $set: {
                state: 'SWAPPING'
            }
        }, cb);
    }

    public static endSwap(slot: BigNumber, newOwner: string, cb: any) {
        CoinState.findOneAndUpdate({
            slot: new BigNumber(slot)
        }, {
            $set: {
                state: 'DEPOSITED',
                owner: newOwner.toLowerCase()
            }
        }, cb);
    }

    public static updateOwner(slot: BigNumber, newOwner: string, cb: any) {
        CoinState.findOneAndUpdate({
            slot: new BigNumber(slot)
        }, {
            $set: {
                owner: newOwner.toLowerCase()
            }
        }, cb);
    }

    // TODO: Find out type of exiting
    public static getOwnedTokens(owner: string, state: string, cb: any) {
        CoinState.find({ owner: owner.toLowerCase(), state: state.toUpperCase() }).exec( (err: Error, slots: Array<ICoinState>) => {
            if(err) {
                console.error(err)
                return cb(err);
            }
            return cb(null, {statusCode: 200, result: slots.map(s => s.slot)});
        });
    }

    public static getOwner(slot: BigNumber, cb: any) {
        CoinState.findOne({slot: slot}).exec( (err: Error, coin: ICoinState) => {
            if(err) return cb(err);
            return cb(null, coin.owner);
        });
    }
}