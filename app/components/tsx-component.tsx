import Vue from 'vue';

interface ITsx {
  render(): JSX.Element;
}

export default abstract class TsxComponent<T> extends Vue implements ITsx {
  private vueTsxProps: Readonly<{}> & Readonly<T>;

  render() {
    return <div />;
  }
}
