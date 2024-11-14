//Library based on :https://github.com/1010Technologies/pxt-makerbit-background
//Library based on :https://github.com/1010Technologies/pxt-makerbit-ir-receiver


/**
 * Custom blocks
 */
//% weight=100 color=#0fbc11 icon="\uf1eb" block="IR"
namespace IR {
    let irState: IrState;
    const IR_REPEAT = 256;
    const IR_INCOMPLETE = 257;
    const IR_DATAGRAM = 258;
    const REPEAT_TIMEOUT_MS = 120;
    interface IrState {
        hasNewDatagram: boolean;
        bitsReceived: uint8;
        addressSectionBits: uint16;
        commandSectionBits: uint16;
        hiword: uint16;
        loword: uint16;
        activeCommand: number;
        repeatTimeout: number;
        IR_callbackUser: () => void;
    }


    function appendBitToDatagram(bit: number): number {
        irState.bitsReceived += 1;

        if (irState.bitsReceived <= 8) {
            irState.hiword = (irState.hiword << 1) + bit;
        } else if (irState.bitsReceived <= 16) {
            irState.hiword = (irState.hiword << 1) + bit;
        } else if (irState.bitsReceived <= 32) {
            irState.loword = (irState.loword << 1) + bit;
        }

        if (irState.bitsReceived === 32) {
            irState.addressSectionBits = irState.hiword & 0xffff;
            irState.commandSectionBits = irState.loword & 0xffff;
            return IR_DATAGRAM;
        } else {
            return IR_INCOMPLETE;
        }
    }

    function decode(markAndSpace: number): number {
        if (markAndSpace < 1600) {
            // low bit
            return appendBitToDatagram(0);
        } else if (markAndSpace < 2700) {
            // high bit
            return appendBitToDatagram(1);
        }

        irState.bitsReceived = 0;

        if (markAndSpace < 12500) {
            // Repeat detected
            return IR_REPEAT;
        } else if (markAndSpace < 14500) {
            // Start detected
            return IR_INCOMPLETE;
        } else {
            return IR_INCOMPLETE;
        }
    }

    function enableIrMarkSpaceDetection(pin: DigitalPin) {
        pins.setPull(pin, PinPullMode.PullNone);

        let mark = 0;
        let space = 0;

        pins.onPulsed(pin, PulseValue.Low, () => {
            // HIGH, see https://github.com/microsoft/pxt-microbit/issues/1416
            mark = pins.pulseDuration();
        });

        pins.onPulsed(pin, PulseValue.High, () => {
            // LOW
            space = pins.pulseDuration();
            const status = decode(mark + space);

            if (status !== IR_INCOMPLETE) {
                handleIrEvent(status);
            }
        });
    }


    function handleIrEvent(irEvent: number) {

        // Refresh repeat timer
        if (irEvent === IR_DATAGRAM || irEvent === IR_REPEAT) {
            irState.repeatTimeout = input.runningTime() + REPEAT_TIMEOUT_MS;
        }

        if (irEvent === IR_DATAGRAM) {
            irState.hasNewDatagram = true;

            if (irState.IR_callbackUser) {
                background.schedule(irState.IR_callbackUser, background.Thread.UserCallback, background.Mode.Once, 0);
            }

            const newCommand = irState.commandSectionBits >> 8;

        }
    }

    function initIrState() {
        if (irState) {
            return;
        }

        irState = {
            bitsReceived: 0,
            hasNewDatagram: false,
            addressSectionBits: 0,
            commandSectionBits: 0,
            hiword: 0, // TODO replace with uint32
            loword: 0,
            activeCommand: -1,
            repeatTimeout: 0,
            IR_callbackUser: undefined,
        };
    }

    /**
     * Init IR .
     */
    //% blockId="IR_init"
    //% block="Init IR"
    //% pin.fieldEditor="gridpicker"
    //% pin.fieldOptions.columns=4
    //% pin.fieldOptions.tooltips="false"
    //% weight=90
    export function IR_init(): void {
        initIrState();
        enableIrMarkSpaceDetection(DigitalPin.P16)
        background.schedule(notifyIrEvents, background.Thread.Priority, background.Mode.Repeat, REPEAT_TIMEOUT_MS);
    }

    function notifyIrEvents() {
        if (irState.activeCommand === -1) {
            // skip to save CPU cylces
        } else {
            const now = input.runningTime();
            if (now > irState.repeatTimeout) {
                // repeat timed out

                // const handler = irState.onIrButtonReleased.find(h => h.irButton === irState.activeCommand || IrButton.Any === h.irButton);
                // if (handler) {
                //     background.schedule(handler.onEvent, background.Thread.UserCallback, background.Mode.Once, 0);
                // }

                irState.bitsReceived = 0;
                irState.activeCommand = -1;
            }
        }
    }

    /**
     * Do something when an IR datagram is received.
     * @param handler body code to run when the event is raised
     */
    //% blockId= IR_callbackUser
    //% block="on IR datagram received"
    //% weight=40
    export function IR_callbackUser(handler: () => void) {
        initIrState();
        irState.IR_callbackUser = handler;
    }

    /**
     * Returns the IR datagram as 32-bit hexadecimal string.
     * The last received datagram is returned or "0x00000000" if no data has been received yet.
     */
    //% blockId=IR_read
    //% block="IR datagram"
    //% weight=30
    export function IR_read(): number {
        basic.pause(0); // Yield to support background processing when called in tight loops
        initIrState();
        return transMind(irState.commandSectionBits & 0x00ff)
    }
    function ir_rec_to16BitHex(value: number): string {
        let hex = "";
        for (let pos = 0; pos < 4; pos++) {
            let remainder = value % 16;
            if (remainder < 10) {
                hex = remainder.toString() + hex;
            } else {
                hex = String.fromCharCode(55 + remainder) + hex;
            }
            value = Math.idiv(value, 16);
        }
        return hex;
    }
    function transMind(data :number):number{
        switch (data) {
            case 255  : data = 0; break;
            case 127  : data = 1; break;
            case 191  : data = 2; break;
            case 223  : data = 4; break;
            case 95   : data = 5; break;
            case 159  : data = 6; break;
            case 239  : data = 8; break;
            case 111  : data = 9; break;
            case 175  : data = 10; break;
            case 207  : data = 12; break;
            case 79   : data = 13; break;
            case 143  : data = 14; break;
            case 247  : data = 16; break;
            case 119  : data = 17; break;
            case 183  : data = 18; break;
            case 215  : data = 20; break;
            case 87   : data = 21; break;
            case 151  : data = 22; break;
            case 231  : data = 24; break;
            case 103  : data = 25; break;
            case 167  : data = 26; break;
            default: break;
        }
        return data;
    }


}




//% deprecated=true
namespace background {

    export enum Thread {
        Priority = 0,
        UserCallback = 1,
    }

    export enum Mode {
        Repeat,
        Once,
    }

    class Executor {
        _newJobs: Job[] = undefined;
        _jobsToRemove: number[] = undefined;
        _pause: number = 100;
        _type: Thread;

        constructor(type: Thread) {
            this._type = type;
            this._newJobs = [];
            this._jobsToRemove = [];
            control.runInParallel(() => this.loop());
        }

        push(task: () => void, delay: number, mode: Mode): number {
            if (delay > 0 && delay < this._pause && mode === Mode.Repeat) {
                this._pause = Math.floor(delay);
            }
            const job = new Job(task, delay, mode);
            this._newJobs.push(job);
            return job.id;
        }

        cancel(jobId: number) {
            this._jobsToRemove.push(jobId);
        }

        loop(): void {
            const _jobs: Job[] = [];

            let previous = control.millis();

            while (true) {
                const now = control.millis();
                const delta = now - previous;
                previous = now;

                // Add new jobs
                this._newJobs.forEach(function (job: Job, index: number) {
                    _jobs.push(job);
                });
                this._newJobs = [];

                // Cancel jobs
                this._jobsToRemove.forEach(function (jobId: number, index: number) {
                    for (let i = _jobs.length - 1; i >= 0; i--) {
                        const job = _jobs[i];
                        if (job.id == jobId) {
                            _jobs.removeAt(i);
                            break;
                        }
                    }
                });
                this._jobsToRemove = []


                // Execute all jobs
                if (this._type === Thread.Priority) {
                    // newest first
                    for (let i = _jobs.length - 1; i >= 0; i--) {
                        if (_jobs[i].run(delta)) {
                            this._jobsToRemove.push(_jobs[i].id)
                        }
                    }
                } else {
                    // Execute in order of schedule
                    for (let i = 0; i < _jobs.length; i++) {
                        if (_jobs[i].run(delta)) {
                            this._jobsToRemove.push(_jobs[i].id)
                        }
                    }
                }

                basic.pause(this._pause);
            }
        }
    }

    class Job {
        id: number;
        func: () => void;
        delay: number;
        remaining: number;
        mode: Mode;

        constructor(func: () => void, delay: number, mode: Mode) {
            this.id = randint(0, 2147483647)
            this.func = func;
            this.delay = delay;
            this.remaining = delay;
            this.mode = mode;
        }

        run(delta: number): boolean {
            if (delta <= 0) {
                return false;
            }

            this.remaining -= delta;
            if (this.remaining > 0) {
                return false;
            }

            switch (this.mode) {
                case Mode.Once:
                    this.func();
                    basic.pause(0);
                    return true;
                case Mode.Repeat:
                    this.func();
                    this.remaining = this.delay;
                    basic.pause(0);
                    return false;
            }
        }
    }

    const queues: Executor[] = [];

    export function schedule(
        func: () => void,
        type: Thread,
        mode: Mode,
        delay: number,
    ): number {
        if (!func || delay < 0) return 0;

        if (!queues[type]) {
            queues[type] = new Executor(type);
        }

        return queues[type].push(func, delay, mode);
    }

    export function remove(type: Thread, jobId: number): void {
        if (queues[type]) {
            queues[type].cancel(jobId);
        }
    }
}


