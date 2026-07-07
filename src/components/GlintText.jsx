import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

const GlintText = ({
    text,
    baseColor = 'grey',
    glintColor = 'gray',
    speed = 200,
    glintWidth = 6,
    typeSpeed = 30, // 👈 New prop! How fast it backspaces and types! ⌨️
    ...props
}) => {
    const [position, setPosition] = useState(-glintWidth);
    const [displayedText, setDisplayedText] = useState(text);

    // 1. The Glint Animation Loop ✨
    useEffect(() => {
        const timer = setInterval(() => {
            // It automatically adapts to the displayedText's changing length!
            setPosition((prev) => (prev > displayedText.length + glintWidth ? -glintWidth - 40 : prev + 1));
        }, speed);
        return () => clearInterval(timer);
    }, [displayedText.length, speed, glintWidth]);

    // 2. The Smart Typewriter Effect 🪄
    useEffect(() => {
        if (text && ((text.includes('Trying to reach') && displayedText && displayedText.includes('Trying to reach')) || (text.includes('Error Occurred') && displayedText && displayedText.includes('Error Occurred')))) {
            setDisplayedText(text);
            return;
        }

        if (displayedText === text) return; // We matched the target text, we can rest! ( ˘⌣˘)♡

        const timer = setTimeout(() => {
            // Figure out what the old and new text have in common
            let commonLen = 0;
            const minLen = Math.min(displayedText.length, text.length);

            while (commonLen < minLen && displayedText[commonLen] === text[commonLen]) {
                commonLen++;
            }

            if (displayedText.length > commonLen) {
                // Phase 1: Backspace the old stuff! 🔙
                setDisplayedText((prev) => prev.slice(0, -1));
            } else if (displayedText.length < text.length) {
                // Phase 2: Type the new stuff! ⌨️✨
                setDisplayedText(text.slice(0, displayedText.length + 1));
            }
        }, typeSpeed);

        return () => clearTimeout(timer);
    }, [text, displayedText, typeSpeed]);

    return (
        <Text>
            {displayedText.split('').map((char, index) => {
                const distance = Math.abs(index - position);
                const color = (distance <= glintWidth / 2) ? glintColor : baseColor;

                return (
                    <Text key={index} color={color} {...props}>
                        {char}
                    </Text>
                );
            })}
        </Text>
    );
};

export default GlintText;
