import { Ionicons } from "@expo/vector-icons"
import { LinearGradient } from "expo-linear-gradient"
import { useEffect, useRef, useState } from "react"
import { Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native"
import IconButton from '../components/IconButton'
import { useTheme } from '../context/ThemeContext'
import SettingsScreen from "./settings"
import { useCallback } from "react"
import { Menu, MenuOptions, MenuOption, MenuTrigger } from 'react-native-popup-menu'

type IconName = keyof typeof Ionicons.glyphMap;

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
}

// Generate a random thread_id for the session
function getThreadId() {
    // You may want to persist this in AsyncStorage for real sessions
    return Math.random().toString(36).slice(2, 12);
}

export default function App() {
    const [isListening, setIsListening] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const { colors, theme } = useTheme();
    const [textInput, setTextInput] = useState('')
    const [messages, setMessages] = useState<Message[]>([]);
    const [wsConnected, setWsConnected] = useState(false);
    const [wsError, setWsError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);
    const threadIdRef = useRef<string>(getThreadId());
    const [wsKey, setWsKey] = useState(0);

    // WebSocket connection
    useEffect(() => {
        const ws = new WebSocket(`ws://192.168.43.115:8000/test/ws-chatbot/${threadIdRef.current}`);
        wsRef.current = ws;

        ws.onopen = () => {
            setWsConnected(true);
            setWsError(null);
            ws.send("hi");
        };
        ws.onclose = () => {
            setWsConnected(false);
        };
        ws.onerror = (e) => {
            setWsError("WebSocket error");
        };


        ws.onmessage = (event) => {
            // Assume server sends: { id, text }
            try {
                const data = event.data;
                setMessages(prev => [
                    ...prev,
                    {
                        id: data.id || Date.now().toString(),
                        text: data,
                        sender: 'ai'
                    }
                ]);
            } catch (e) {
                // fallback: treat as plain text
                console.error("Error parsing message:", e);
            }
        };

        return () => {
            ws.close();
        };
    }, [wsKey]);

    // Reconnect function
    const handleReconnect = useCallback(() => {
        setWsKey(k => k + 1);
    }, []);

    // Scroll to bottom on new message
    useEffect(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
    }, [messages]);

    const handlePress = () => {
        setIsListening(true)
    }

    const toggleSettings = () => {
        setShowSettings(!showSettings)
    }

    const handleSendText = () => {
        if (textInput.trim() && wsRef.current && wsConnected) {
            const newMessage: Message = {
                id: Date.now().toString(),
                text: textInput,
                sender: 'user'
            };
            setMessages(prev => [...prev, newMessage]);
            wsRef.current.send(textInput);
            setTextInput('');
        } else if (!wsConnected) {
            Alert.alert("Not connected", "Unable to send message: not connected to server.");
        }
    }

    if (showSettings) {
        return <SettingsScreen onBack={() => setShowSettings(false)} />
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Fixed Header */}
                <View style={styles.header}>
                    <Menu>
                        <MenuTrigger>
                            <Ionicons name="ellipsis-vertical" size={24} color={colors.text} />
                        </MenuTrigger>
                        <MenuOptions>
                            <MenuOption onSelect={handleReconnect} text="Reconnect to server" />
                        </MenuOptions>
                    </Menu>
                    {/* <View style={{ flex: 1 }} /> */}
                    <IconButton name="settings" onPress={toggleSettings} />
                </View>

                {/* Scrollable Messages */}
                <View style={styles.messagesWrapper}>
                    <ScrollView
                        style={styles.messagesList}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.messagesContent}
                        ref={scrollViewRef}
                    >
                        {messages.map((message) => (
                            <View
                                key={message.id}
                                style={[
                                    styles.messageContainer,
                                    message.sender === 'user'
                                        ? [styles.userMessage, { backgroundColor: colors.surface }]
                                        : [styles.aiMessage, {
                                            backgroundColor: colors.background,
                                            borderColor: colors.surface
                                        }]
                                ]}
                            >
                                <Text style={[
                                    styles.messageText,
                                    { color: colors.text }
                                ]}>
                                    {message.text}
                                </Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>
                {/* Listening Indicator */}
                {isListening && (
                    <View style={[
                        styles.ListeningContainer,
                        {
                            backgroundColor: "transparent",
                            borderColor: colors.surface
                        }
                    ]}>
                        <Text style={[styles.listeningText, { color: colors.text }]}>
                            Listening...
                        </Text>
                    </View>
                )}
                {/* WebSocket status */}
                {!wsConnected && (
                    <View style={{ alignItems: 'center', marginBottom: 8, backgroundColor: "transparent" }}>
                        <Text style={{ color: 'red' }}>
                            {wsError ? wsError : "Connecting to server..."}
                        </Text>
                    </View>
                )}
                {/* Fixed Input Area */}
                <View style={styles.buttonContainer}>
                    <View style={styles.textInputContainer}>
                        <TextInput
                            style={[styles.textInput, {
                                color: colors.text,
                                backgroundColor: colors.surface
                            }]}
                            value={textInput}
                            onChangeText={setTextInput}
                            placeholder="Type a message..."
                            placeholderTextColor={colors.tabIconDefault}
                            onSubmitEditing={handleSendText}
                            returnKeyType="send"
                            editable={wsConnected}
                        />
                    </View>
                    <TouchableOpacity onPress={handleSendText} style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        backgroundColor: colors.surface,
                        justifyContent: "center",
                        alignItems: "center",
                    }}>
                        <Ionicons name="send" size={20} color={colors.text} />
                    </TouchableOpacity>

                    <TouchableOpacity activeOpacity={0.7} onPress={handlePress} style={styles.buttonOuter}>
                        <LinearGradient
                            colors={[colors.surface, colors.text]}
                            style={styles.gradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <View style={[styles.buttonInner, { backgroundColor: colors.background }]}>
                                <Ionicons name="mic" size={28} color={colors.text} />
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </SafeAreaView >
        </KeyboardAvoidingView >
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 10,
    },
    header: {
        backgroundColor: 'transparent',
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 20,
        marginBottom: 10,
    },
    content: {
        flex: 1,
    },
    buttonContainer: {
        backgroundColor: 'transparent',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: Platform.OS === 'ios' ? 25 : 15,
        marginBottom: Platform.OS === 'ios' ? 25 : 15,
        gap: 10,
        // paddingHorizontal: 15,
    },
    buttonOuter: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    gradient: {
        width: "100%",
        height: "100%",
        borderRadius: 35,
        justifyContent: "center",
        alignItems: "center",
    },
    buttonInner: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: "center",
        alignItems: "center",
    },
    textInputContainer: {
        flex: 1,
    },
    textInput: {
        height: 50,
        borderRadius: 24,
        paddingHorizontal: 20,
        fontSize: 16,
    },
    messagesWrapper: {
        flex: 1,
        marginHorizontal: -15,
    },
    messagesList: {
        flex: 1,
    },
    messagesContent: {
        padding: 20,
        gap: 10,
    },
    messageContainer: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
    },
    userMessage: {
        alignSelf: 'flex-end',
        borderBottomRightRadius: 0,
    },
    aiMessage: {
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 0,
        borderWidth: 1,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
    },
    ListeningContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: Platform.OS === 'ios' ? 25 : 15,
        gap: 10,
        paddingHorizontal: 15,
    },
    listeningText: {
        fontSize: 16,
        alignSelf: 'center',
    },
})
