IR.IR_callbackUser(function () {
    serial.writeLine("" + (IR.IR_read()))
})
IR.IR_init()
