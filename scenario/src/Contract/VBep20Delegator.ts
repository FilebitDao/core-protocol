import { Contract } from "../Contract";
import { Callable, Sendable } from "../Invokation";
import { NTokenMethods } from "./NToken";

interface VBep20DelegatorMethods extends NTokenMethods {
  implementation(): Callable<string>;
  _setImplementation(implementation_: string, allowResign: boolean, becomImplementationData: string): Sendable<void>;
}

export interface VBep20Delegator extends Contract {
  methods: VBep20DelegatorMethods;
  name: string;
}

export interface VBep20DelegatorScenario extends Contract {
  methods: VBep20DelegatorMethods;
  name: string;
}
