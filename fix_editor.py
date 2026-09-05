p = 'src/components/features/upload-capture/ImageEditor.tsx'
L = open(p, encoding='utf-8').read().split('\n')
# helpers block: lines 321..344 (0-based) = blank + two helper functions
helpers = L[321:344]
assert helpers[0] == '' and 'getCropHandlePositions' in helpers[1], (helpers[0], helpers[1][:50])
assert helpers[-1] == '  };', repr(helpers[-1])
# draw comment at index 149
assert L[149].strip().startswith('// --- Drawing Core Engine'), L[149]
del L[321:345]
out = L[:149] + [h for h in helpers if h != ''] + [''] + L[149:]
open(p, 'w', encoding='utf-8').write('\n'.join(out))
print('moved ok')