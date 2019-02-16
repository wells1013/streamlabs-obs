import { Component, Prop } from 'vue-property-decorator';
import { IObsInput, TObsType, ObsInput, IObsNumberInputValue } from './ObsInput';
import HFormGroup from 'components/shared/inputs/HFormGroup.vue';
import { NumberInput } from 'components/shared/inputs/inputs';

@Component({
  components: { HFormGroup, NumberInput },
})
class ObsNumberInput extends ObsInput<IObsNumberInputValue> {
  static obsType: TObsType[];

  @Prop()
  value: IObsNumberInputValue;

  $refs: {
    input: HTMLInputElement;
  };

  get metadata() {
    return {
      min: this.value.minVal,
      max: this.value.maxVal,
      disabled: this.value.enabled === false,
      isInteger: true,
    };
  }

  updateValue(value: number) {
    this.emitInput({ ...this.value, value });
  }
}

ObsNumberInput.obsType = ['OBS_PROPERTY_DOUBLE', 'OBS_PROPERTY_FLOAT'];

export default ObsNumberInput;
