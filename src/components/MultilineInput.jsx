import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Box, Spacer, Text, useInput, measureElement } from 'ink';

function expandTabs(text, tabSize) {
  return text.replace(/\t/g, ' '.repeat(tabSize));
}

function normalizeLineEndings(text) {
  if (text == null) return '';
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

const MeasureBox = ({ children, onHeightChange }) => {
  const ref = useRef(null);
  const lastHeightRef = useRef(undefined);
  useEffect(() => {
    if (ref.current) {
      const { height } = measureElement(ref.current);
      if (lastHeightRef.current !== height) {
        lastHeightRef.current = height;
        onHeightChange?.(height);
      }
    }
  });
  return <Box ref={ref} flexShrink={0} flexGrow={0} width="100%">{children}</Box>;
};

export const ControlledMultilineInput = ({
  value,
  rows,
  maxRows,
  highlightStyle,
  textStyle,
  placeholder = '',
  mask,
  showCursor = true,
  focus = true,
  tabSize = 4,
  cursorIndex = 0,
  highlight,
  refreshKey
}) => {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [markerHeight, setMarkerHeight] = useState(0);

  const formatText = useCallback(
    (text, isPlaceholder = false) => {
      const normalized = normalizeLineEndings(text);
      if (!isPlaceholder && mask) {
        return normalized.replace(/[^\n]/g, mask);
      }
      const expanded = expandTabs(normalized, tabSize);
      if (isPlaceholder) return expanded;
      return expanded.replace(/@\[(.*?)\]/g, (match, p1) => {
        const hashIdx = p1.indexOf('#');
        const colonIdx = p1.indexOf(':L');
        let pathOnly = p1;
        let suffix = '';
        if (hashIdx !== -1) {
          pathOnly = p1.slice(0, hashIdx);
          suffix = p1.slice(hashIdx);
        } else if (colonIdx !== -1) {
          pathOnly = p1.slice(0, colonIdx);
          suffix = p1.slice(colonIdx);
        }
        let rel = pathOnly.replace(/\\/g, '/');
        const cwd = (process.cwd() || '').replace(/\\/g, '/');
        if (cwd && rel.toLowerCase().startsWith(cwd.toLowerCase() + '/')) {
          rel = rel.slice(cwd.length + 1);
        } else if (rel.startsWith('./')) {
          rel = rel.slice(2);
        }
        const parts = rel.split('/');
        const basename = parts[parts.length - 1];
        return `[${basename}${suffix}]`;
      });
    },
    [tabSize, mask]
  );

  const { preCursor, postCursor } = useMemo(() => {
    if (!value) {
      if (placeholder && !focus) {
        return {
          preCursor: [{ value: formatText(placeholder, true), type: 'placeholder' }],
          postCursor: []
        };
      }
      return {
        preCursor: [{ value: ' ', type: 'cursor' }],
        postCursor: []
      };
    }
    const textBefore = value.slice(0, cursorIndex);
    const textAfter = value.slice(cursorIndex);
    if (!focus) {
      return {
        preCursor: [{ value: formatText(value) }],
        postCursor: []
      };
    }
    const hasValidHighlight = highlight && highlight.end > highlight.start && highlight.start >= 0 && highlight.end <= value.length;
    if (!hasValidHighlight) {
      const formattedBefore = formatText(textBefore);
      const formattedAfter = formatText(textAfter);
      const lineStart = formattedBefore.lastIndexOf('\n') + 1;
      const lineEnd = formattedAfter.indexOf('\n');
      return {
        preCursor: [
          { value: formattedBefore.slice(0, lineStart) },
          { value: formattedBefore.slice(lineStart), type: 'highlight' },
          { value: showCursor && focus ? ' ' : '', type: 'cursor' }
        ],
        postCursor: [
          { value: formattedAfter.slice(0, lineEnd), type: 'highlight' },
          { value: formattedAfter.slice(lineEnd) }
        ]
      };
    } else {
      return {
        preCursor: [
          { value: formatText(textBefore.slice(0, highlight.start)) },
          {
            value: formatText(textBefore.slice(highlight.start, Math.min(highlight.end, cursorIndex))),
            type: 'highlight'
          },
          { value: formatText(textBefore.slice(highlight.end)) },
          { value: ' ', type: 'cursor' }
        ],
        postCursor: [
          {
            value: formatText(textAfter.slice(0, Math.max(highlight.start - cursorIndex, 0)))
          },
          {
            value: formatText(textAfter.slice(Math.max(highlight.start - cursorIndex, 0), Math.max(highlight.end - cursorIndex, 0))),
            type: 'highlight'
          },
          {
            value: formatText(textAfter.slice(Math.max(highlight.end - cursorIndex, 0)))
          }
        ]
      };
    }
  }, [cursorIndex, showCursor, focus, value, placeholder, mask, highlight, formatText, refreshKey]);

  const visibleRows = useMemo(() => {
    if (contentHeight !== undefined) {
      return Math.max(rows ?? maxRows ?? 1, Math.min(maxRows ?? rows ?? 1, contentHeight));
    }
    return 1;
  }, [rows, maxRows, contentHeight]);

  useEffect(() => {
    if (markerHeight !== undefined && visibleRows !== undefined) {
      const cursorLineEnd = markerHeight;
      setScrollOffset((prevOffset) => {
        const viewportStart = prevOffset;
        const viewportEnd = prevOffset + visibleRows;
        if (cursorLineEnd <= viewportStart) {
          return Math.max(0, cursorLineEnd - 1);
        } else if (cursorLineEnd > viewportEnd) {
          return cursorLineEnd - visibleRows;
        } else if (contentHeight) {
          if (contentHeight < visibleRows) {
            return 0;
          } else if (contentHeight < viewportEnd) {
            return contentHeight - visibleRows;
          }
        }
        return prevOffset;
      });
    }
  }, [markerHeight, visibleRows, contentHeight]);

  const getStyle = useCallback(
    (type) => {
      switch (type) {
        case 'placeholder':
          return { ...textStyle, dimColor: true };
        case 'highlight':
          return highlightStyle ?? textStyle;
        case 'cursor':
          return {
            ...highlightStyle ?? textStyle,
            inverse: showCursor && focus
          };
        default:
          return textStyle;
      }
    },
    [textStyle, highlightStyle, showCursor, focus]
  );

  return (
    <Box height={visibleRows} overflow="hidden" flexDirection="column" flexGrow={0} flexShrink={0}>
      <Box flexDirection="column">
        <Box height={visibleRows} overflowY="hidden" flexShrink={0} flexDirection="column">
          <Box marginTop={-scrollOffset} flexDirection="column">
            <MeasureBox onHeightChange={setContentHeight}>
              <Text>
                {preCursor?.map((segment, idx) => <Text key={idx} {...getStyle(segment.type)}>{segment.value}</Text>)}
                {postCursor?.map((segment, idx) => <Text key={idx} {...getStyle(segment.type)}>{segment.value}</Text>)}
              </Text>
            </MeasureBox>
          </Box>
          <Spacer />
        </Box>
        <MeasureBox onHeightChange={setMarkerHeight}>
          <Text>
            {preCursor?.map((segment, idx) => <Text key={idx} {...getStyle(segment.type)}>{segment.value}</Text>)}
          </Text>
        </MeasureBox>
      </Box>
    </Box>
  );
};

export const MultilineInput = ({
  value,
  onChange,
  onSubmit,
  keyBindings,
  showCursor = true,
  highlightPastedText = false,
  focus = true,
  useCustomInput = (inputHandler, isActive) => useInput(inputHandler, { isActive }),
  ...controlledProps
}) => {
  const [cursorIndex, setCursorIndex] = useState(value.length);
  const [pasteLength, setPasteLength] = useState(0);

  useEffect(() => {
    if (cursorIndex > value.length) {
      setCursorIndex(value.length);
    }
  }, [value, cursorIndex]);

  useCustomInput((input, key) => {
    const submitKey = keyBindings?.submit ?? ((key2) => key2.return && key2.ctrl);
    const newlineKey = keyBindings?.newline ?? ((key2) => key2.return);
    if (submitKey(key)) {
      onSubmit?.(value);
      return;
    } else if (newlineKey(key)) {
      const newValue = value.slice(0, cursorIndex) + '\n' + value.slice(cursorIndex);
      onChange(newValue);
      setCursorIndex(cursorIndex + 1);
      setPasteLength(0);
      return;
    }
    if (key.tab || (key.shift && key.tab) || (key.ctrl && input === 'c')) {
      return;
    }
    if (keyBindings?.newline?.(key)) {
      const newValue = value.slice(0, cursorIndex) + '\n' + value.slice(cursorIndex);
      onChange(newValue);
      setCursorIndex(cursorIndex + 1);
      setPasteLength(0);
      return;
    }
    let nextPasteLength = 0;
    if (input.length > 1) {
      nextPasteLength = input.length;
    }
    if (key.upArrow) {
      if (showCursor) {
        const lines = normalizeLineEndings(value).split('\n');
        let currentLineIndex = 0;
        let currentPos = 0;
        let col = 0;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line === undefined) continue;
          const lineLen = line.length;
          const lineEnd = currentPos + lineLen;
          if (cursorIndex >= currentPos && cursorIndex <= lineEnd) {
            currentLineIndex = i;
            col = cursorIndex - currentPos;
            break;
          }
          currentPos = lineEnd + 1;
        }
        if (currentLineIndex > 0) {
          const targetLineIndex = currentLineIndex - 1;
          const targetLine = lines[targetLineIndex];
          if (targetLine !== undefined) {
            const targetLineLen = targetLine.length;
            const newCol = Math.min(col, targetLineLen);
            let newIndex = 0;
            for (let i = 0; i < targetLineIndex; i++) {
              newIndex += lines[i].length + 1;
            }
            newIndex += newCol;
            setCursorIndex(newIndex);
            setPasteLength(0);
          }
        }
      }
    } else if (key.downArrow) {
      if (showCursor) {
        const lines = normalizeLineEndings(value).split('\n');
        let currentLineIndex = 0;
        let currentPos = 0;
        let col = 0;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line === undefined) continue;
          const lineLen = line.length;
          const lineEnd = currentPos + lineLen;
          if (cursorIndex >= currentPos && cursorIndex <= lineEnd) {
            currentLineIndex = i;
            col = cursorIndex - currentPos;
            break;
          }
          currentPos = lineEnd + 1;
        }
        if (currentLineIndex < lines.length - 1) {
          const targetLineIndex = currentLineIndex + 1;
          const targetLine = lines[targetLineIndex];
          if (targetLine !== undefined) {
            const targetLineLen = targetLine.length;
            const newCol = Math.min(col, targetLineLen);
            let newIndex = 0;
            for (let i = 0; i < targetLineIndex; i++) {
              newIndex += lines[i].length + 1;
            }
            newIndex += newCol;
            setCursorIndex(newIndex);
            setPasteLength(0);
          }
        }
      }
    } else if (key.leftArrow) {
      if (showCursor) {
        setCursorIndex(Math.max(0, cursorIndex - 1));
        setPasteLength(0);
      }
    } else if (key.rightArrow) {
      if (showCursor) {
        setCursorIndex(Math.min(value.length, cursorIndex + 1));
        setPasteLength(0);
      }
    } else if (key.return) {
      const newValue = value.slice(0, cursorIndex) + '\n' + value.slice(cursorIndex);
      onChange(newValue);
      setCursorIndex(cursorIndex + 1);
      setPasteLength(0);
    } else if (key.backspace || key.delete) {
      if (cursorIndex > 0) {
        const newValue = value.slice(0, cursorIndex - 1) + value.slice(cursorIndex);
        onChange(newValue);
        setCursorIndex(cursorIndex - 1);
        setPasteLength(0);
      }
    } else {
      if (input) {
        const newValue = value.slice(0, cursorIndex) + input + value.slice(cursorIndex);
        onChange(newValue);
        setCursorIndex(cursorIndex + input.length);
        setPasteLength(nextPasteLength);
      }
    }
  }, focus);

  const highlight = useMemo(() => {
    if (highlightPastedText && pasteLength > 1) {
      return {
        start: Math.max(0, cursorIndex - pasteLength),
        end: cursorIndex
      };
    }
    return undefined;
  }, [cursorIndex, pasteLength, highlightPastedText]);

  return (
    <ControlledMultilineInput
      {...controlledProps}
      value={value}
      cursorIndex={cursorIndex}
      highlight={highlight}
      showCursor={showCursor}
      focus={focus}
    />
  );
};
