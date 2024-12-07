import { App } from 'cdktf';
import Stage from 'stage';

const app = new App();
new Stage(app);

app.synth();
