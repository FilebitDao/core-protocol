import { Contract } from "../Contract";
import { Sendable } from "../Invokation";
import { NTokenMethods, NTokenScenarioMethods } from "./NToken";

interface VBep20DelegateMethods extends NTokenMethods {
  _becomeImplementation(data: string): Sendable<void>;
  _resignImplementation(): Sendable<void>;
}

interface VBep20DelegateScenarioMethods extends NTokenScenarioMethods {
  _becomeImplementation(data: string): Sendable<void>;
  _resignImplementation(): Sendable<void>;
}

export interface VBep20Delegate extends Contract {
  methods: VBep20DelegateMethods;
  name: string;
}

export interface VBep20DelegateScenario extends Contract {
  methods: VBep20DelegateScenarioMethods;
  name: string;
}
