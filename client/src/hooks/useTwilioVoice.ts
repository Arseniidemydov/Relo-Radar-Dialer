
import { useState, useEffect } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import axios from 'axios';

interface UseTwilioVoiceProps {
    tokenEndpoint: string;
}

export const useTwilioVoice = ({ tokenEndpoint }: UseTwilioVoiceProps) => {
    const [device, setDevice] = useState<Device | null>(null);
    const [call, setCall] = useState<Call | null>(null);
    const [deviceState, setDeviceState] = useState<string>('initializing'); // initializing, ready, offline
    const [callState, setCallState] = useState<string>('idle'); // idle, connecting, ringing, open, closed
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        let currentDevice: Device | null = null;

        const initializeDevice = async () => {
            console.log("Initializing Twilio Device...");
            try {
                console.log("Fetching token from:", tokenEndpoint);
                const { data } = await axios.get(tokenEndpoint);
                console.log("Token received");

                if (!mounted) return;

                const newDevice = new Device(data.token, {
                    logLevel: 1,
                    codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU]
                });

                currentDevice = newDevice;

                newDevice.on('ready', () => {
                    console.log('Twilio Device Ready event fired');
                    if (mounted) setDeviceState('ready');
                });

                newDevice.on('error', (err: any) => {
                    console.error('Twilio Device Error event:', err);
                    if (mounted) {
                        setError(err.message);
                        setDeviceState('error');
                    }
                });

                newDevice.on('registered', () => {
                    console.log('Twilio Device Registered');
                });

                newDevice.on('unregistered', () => {
                    console.log('Twilio Device Unregistered');
                });

                // Register the device
                console.log("Registering device...");
                await newDevice.register();
                console.log("Device registration promise resolved");

                if (mounted) {
                    setDevice(newDevice);
                    setDeviceState('ready'); // Force ready state after successful registration
                } else {
                    // If unmounted during registration, destroy immediately
                    newDevice.destroy();
                }

            } catch (err: any) {
                console.error('Failed to initialize Twilio device', err);
                if (mounted) {
                    setError(err.message || 'Failed to fetch token or init device');
                    setDeviceState('error');
                }
            }
        };

        initializeDevice();

        return () => {
            mounted = false;
            if (currentDevice) {
                console.log("Cleaning up Twilio Device...");
                currentDevice.destroy();
            }
        };
    }, [tokenEndpoint]);

    const makeCall = async (leadId: string, phoneNumber: string) => {
        if (!device) return;

        try {
            setCallState('connecting');
            // Pass leadId to the backend so it can be added to the status callback
            const newCall = await device.connect({
                params: {
                    To: phoneNumber,
                    leadId: leadId
                }
            });

            newCall.on('accept', () => setCallState('open'));
            newCall.on('disconnect', () => {
                setCallState('idle');
                setCall(null);
            });
            newCall.on('cancel', () => {
                setCallState('idle');
                setCall(null);
            });
            newCall.on('reject', () => {
                setCallState('idle');
                setCall(null);
            });
            newCall.on('error', (err) => {
                console.error('Call Error:', err);
                setError(err.message);
                setCallState('idle');
            });

            setCall(newCall);
        } catch (err: any) {
            console.error('Error making call:', err);
            setError(err.message);
            setCallState('idle');
        }
    };

    const hangup = () => {
        if (call) {
            call.disconnect();
        }
    };

    return { device, deviceState, call, callState, error, makeCall, hangup };
};
