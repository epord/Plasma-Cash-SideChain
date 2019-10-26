import BigNumber from "bignumber.js";
import {ICoinState} from "../models/coinStateModel";
import {CoinStateService} from ".";

export class CoinState {

    public static findBySlot(slot: BigNumber, cb: any) {
        CoinStateService.findById(slot).exec( (err: Error, coinState: ICoinState) => {
            if(err) return cb(err);
            return cb(null, coinState);
        });
    }

    public static exitSlot(slot: BigNumber, cb: any) {
        CoinStateService.findByIdAndUpdate(slot, {
            $set: {
                state: 'EXITING'
            }
        }, cb);
    }

    public static resetSlot(slot: BigNumber, cb: any) {
        CoinStateService.findByIdAndUpdate(slot, {
            $set: {
                state: 'DEPOSITED'
            }
        }, cb);
    }

    public static swapSlot(slot: BigNumber, cb: any) {
        CoinStateService.findByIdAndUpdate(slot, {
            $set: {
                state: 'SWAPPING'
            }
        }, cb);
    }

    public static endSwap(slot: BigNumber, newOwner: string, cb: any) {
        CoinStateService.findByIdAndUpdate(slot, {
            $set: {
                state: 'DEPOSITED',
                owner: newOwner.toLowerCase()
            }
        }, cb);
    }

    public static updateOwner(slot: BigNumber, newOwner: string, cb: any) {
        CoinStateService.findByIdAndUpdate(slot, {
            $set: {
                owner: newOwner.toLowerCase()
            }
        }, cb);
    }

    public static getOwnedTokens(owner: string, state: string, cb: any) {
        CoinStateService.find({ owner: owner.toLowerCase(), state: state.toUpperCase() }).exec( (err: Error, slots: Array<ICoinState>) => {
            if(err) {
                console.error(err)
                return cb(err);
            }
            return cb(null, {statusCode: 200, result: slots.map(s => s.slot)});
        });
    }

    public static getOwner(slot: BigNumber, cb: any) {
        CoinStateService.findById(slot).exec( (err: Error, coin: ICoinState) => {
            if(err) return cb(err);
            return cb(null, coin.owner);
        });
    }
}