import type {NullishDeep} from '../../dist/types';

interface TextEditor {
    fontSize: number;
    fontColor: string;
    fontWeight: number;
}

interface Settings {
    textEditor: TextEditor;
    autosave: boolean;
}

// Interface-based Onyx value types must support partial nested null updates via NullishDeep
const partialSettingsUpdate: NullishDeep<Settings> = {
    textEditor: {fontWeight: 500, fontColor: null},
};

export default partialSettingsUpdate;
