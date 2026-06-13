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
        preCursor: [{ value: showCursor && focus ? ' ' : '', type: 'cursor' }],
        postCursor: []
      };
    }

    const textBefore = value.slice(0, cursorIndex);
    const charAtCursor = value[cursorIndex] || ' ';
    const textAfter = value.slice(cursorIndex + 1);

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
      const lineEnd = formattedAfter.indexOf('\n') === -1 ? formattedAfter.length : formattedAfter.indexOf('\n');
      
      return {
        preCursor: [
          { value: formattedBefore.slice(0, lineStart) },
          { value: formattedBefore.slice(lineStart), type: 'highlight' },
          { value: formatText(charAtCursor), type: 'cursor' }
        ],
        postCursor: [
          { value: formattedAfter.slice(0, lineEnd), type: 'highlight' },
          { value: formattedAfter.slice(lineEnd) }
        ]
      };
    } else {
      // In highlight mode, we still use the standard cursor split but handle charAtCursor
      return {
        preCursor: [
          { value: formatText(value.slice(0, Math.min(cursorIndex, highlight.start))) },
          {
            value: formatText(value.slice(Math.max(0, highlight.start), Math.min(highlight.end, cursorIndex))),
            type: 'highlight'
          },
          { value: formatText(value.slice(Math.max(highlight.end, 0), cursorIndex)) },
          { value: formatText(charAtCursor), type: 'cursor' }
        ],
        postCursor: [
          {
            value: formatText(value.slice(cursorIndex + 1, Math.max(cursorIndex + 1, highlight.start)))
          },
          {
            value: formatText(value.slice(Math.max(cursorIndex + 1, highlight.start), Math.max(cursorIndex + 1, highlight.end))),
            type: 'highlight'
          },
          {
            value: formatText(value.slice(Math.max(cursorIndex + 1, highlight.end)))
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
            ...textStyle,
            color: (showCursor && focus) ? 'white' : undefined,
            bold: showCursor && focus,
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
  lastFocusEventTime = 0,
  columns = 80,
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

  // Helper to calculate visual mapping of cursor index to line/col
  const getVisualPosition = useCallback((index) => {
    const text = normalizeLineEndings(value);
    const lines = text.split('\n');
    const wrapWidth = Math.max(20, columns - 10); // Sync with App.jsx wrap logic

    let visualLine = 0;
    let visualCol = 0;
    let currentIdx = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLen = line.length;

      // Check if the index is within this literal line (including newline)
      if (index >= currentIdx && index <= currentIdx + lineLen) {
        const offsetInLine = index - currentIdx;
        visualLine += Math.floor(offsetInLine / wrapWidth);
        visualCol = offsetInLine % wrapWidth;
        return { visualLine, visualCol };
      }

      // If not, calculate how many visual lines this literal line took
      const numVisualLines = Math.max(1, Math.ceil(lineLen / wrapWidth));
      visualLine += numVisualLines;
      currentIdx += lineLen + 1; // +1 for the \n
    }

    return { visualLine, visualCol };
  }, [value, columns]);

  // Helper to find cursor index from visual position
  const getIndexFromVisual = useCallback((targetLine, targetCol) => {
    const text = normalizeLineEndings(value);
    const lines = text.split('\n');
    const wrapWidth = Math.max(20, columns - 10);

    let currentVisualLine = 0;
    let currentIdx = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLen = line.length;
      const numVisualLines = Math.max(1, Math.ceil(lineLen / wrapWidth));

      // Is the target visual line within this literal line?
      if (targetLine >= currentVisualLine && targetLine < currentVisualLine + numVisualLines) {
        const lineOffset = (targetLine - currentVisualLine) * wrapWidth;
        const colInLine = Math.min(targetCol, lineLen - lineOffset);
        
        // Ensure we don't go past the current literal line's end
        const finalCol = Math.max(0, colInLine);
        return Math.min(currentIdx + lineOffset + finalCol, currentIdx + lineLen);
      }

      currentVisualLine += numVisualLines;
      currentIdx += lineLen + 1;
    }
    
    return value.length;
  }, [value, columns]);

  useCustomInput((input, key) => {
    // Aggressively swallow focus reporting artifacts ([I, [O)
    if (input === '\x1b[I' || input === '\x1b[O' || input === '[I' || input === '[O') {
      return;
    }

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
    
    let nextPasteLength = 0;
    if (input.length > 1) {
      nextPasteLength = input.length;
    }
    if (key.upArrow) {
      if (showCursor) {
        const { visualLine, visualCol } = getVisualPosition(cursorIndex);
        if (visualLine > 0) {
          const newIndex = getIndexFromVisual(visualLine - 1, visualCol);
          setCursorIndex(newIndex);
          setPasteLength(0);
        }
      }
    } else if (key.downArrow) {
      if (showCursor) {
        const { visualLine, visualCol } = getVisualPosition(cursorIndex);
        const newIndex = getIndexFromVisual(visualLine + 1, visualCol);
        if (newIndex !== cursorIndex) {
          setCursorIndex(newIndex);
          setPasteLength(0);
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
