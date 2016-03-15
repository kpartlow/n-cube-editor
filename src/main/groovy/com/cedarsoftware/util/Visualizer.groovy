package com.cedarsoftware.util

import com.cedarsoftware.ncube.NCube
import groovy.transform.CompileStatic
import ncube.grv.method.NCubeGroovyController

/**
 * Creates the json used to create a visualization of the rpm cubes associated with a given rpm cube.
 */

@CompileStatic
class Visualizer extends NCubeGroovyController
{
	public static final String RPM_CLASS = 'rpm.class'
	public static final String RPM_ENUM = 'rpm.enum'
	public static final String RPM_CLASS_DOT = 'rpm.class.'
	public static final String RPM_ENUM_DOT = 'rpm.enum.'
	public static final String CLASS_TRAITS = 'CLASS_TRAITS'
	public static final String R_RPM_TYPE = 'r:rpmType'
	public static final String V_ENUM = 'v:enum'
	public static final String R_SCOPED_NAME = 'r:scopedName'
	public static final String R_EXISTS = 'r:exists'
	public static final String V_MIN = 'v:min'
	public static final String V_MAX = 'v:max'
	public static final String PD_BUS_TYPE = 'pd:busType'

	public static final String TARGET_CUBE = 'targetCube'
	public static final String TARGET_TRAIT_MAPS = 'targetTraitMaps'
	public static final String SOURCE_CUBE = 'sourceCube'
	public static final String SOURCE_TRAIT_MAPS = 'sourceTraitMaps'
	public static final String SOURCE_FIELD = 'sourceField'
	public static final String SOURCE_FIELD_NAME = 'sourceFieldName'
	public static final String SOURCE_FIELD_RPM_TYPE = 'sourceFieldRpmType'
	public static final String SOURCE_SCOPE = 'sourceScope'
	public static final String TARGET_SCOPE = 'targetScope'

	public static final String AXIS_FIELD = 'field'
	public static final String AXIS_NAME = 'name'
	public static final String AXIS_TRAIT = 'trait'
	
	public static final String MAX_LEVEL = 'maxLevel'
	public static final String NODE_COUNT = 'nodeCount'
	public static final String TARGET_LEVEL = 'targetLevel'
	public static final String SELECTED_LEVEL = 'selectedLevel'

	public static final String SELECTED_GROUPS = 'selectedGroups'
	public static final String AVAILABLE_GROUPS_ALL_LEVELS = 'availableGroupsAllLevels'
	public static final String GROUP_SUFFIX = 'groupSuffix'
	public static final String _ENUM = '_ENUM'
	public static final String ALL_GROUPS = 'allGroups'
	public static final String UNSPECIFIED = 'UNSPECIFIED'
	public static final Map ALL_GROUPS_MAP = [PRODUCT:'Product', FORM:'Form', FORMDATA:'Form data', RISK:'Risk', COVERAGE:'Coverage', CONTAINER:'Container', DEDUCTIBLE:'Deductible', LIMIT:'Limit', RATE:'Rate', RATEFACTOR:'Rate factor', PREMIUM:'Premium', PARTY:'Party', PLACE:'Place', UNSPECIFIED:'Unspecified']

	public static final String STACK_KEY = 'stackKey'
	
	public static final Map DEFAULT_SCOPE = [context: 'Edit', action: 'Edit']
	public static final String DEFAULT_LEVEL = 2

	private static final String SPACE = '&nbsp;'

	public static final String CELL_INFO_SUFFIX = '_CELL_INFO'
	public static final String SOURCE_SCOPE_KEY_PREFIX = 'source'

	private VisualizerHelper helper = new VisualizerHelper()

	private Map stack = [:]
	private Map stackInfo = [:]
	private Map levels = [:]
	private Map groups = [:]
	private List nodes = []
	private List edges = []
	private List messages = []
	private Set visited = []

	/**
	 * Creates the json used to create a visualization of the rpm cubes associated with a given rpm cube.
	 *
	 * input:
	 * 	          String startCubeName, name of the starting cube
	 *            Map scope
	 *            Object[] selectedGroups, indicates which groups should be included in the visualization
	 *            Object selectedLevel, indicates the depth of traversal from the start cube
	 *
	 * output     String visualization json
	 *
	 */
	Map buildGraph()
	{
		Map options = input.options as Map
		String startCubeName = options.startCubeName as String
		Set selectedGroups = options.selectedGroups as Set
		String selectedLevel = options.selectedLevel as String
		Map scope = options.scope as Map
		helper.ncube = ncube

		//TODO: This is a temp location for checking scope. Move check for scope to where traitMaps are obtained.
		//TODO: Also handle the user adding the required scope key but with a value that results in a no hit.
		Map map = checkMissingScope(startCubeName, scope)
		if (map) {
			return [status: 'missingScope', message: map.message, scope: map.scope]
		}
		map = getRpmVisualizationMap(startCubeName, scope, selectedGroups, selectedLevel)
		return [status: 'success', map: map, message: map.message]
	}

	private Map getRpmVisualizationMap(String startCubeName, Map scope, Set selectedGroups, String selectedLevel)
	{
		levels[MAX_LEVEL] = 1
		levels[NODE_COUNT] = 1
		levels[SELECTED_LEVEL] = selectedLevel == null ? DEFAULT_LEVEL :  Converter.convert(selectedLevel, long.class)
		stackInfo[TARGET_LEVEL] = 1
		stackInfo[STACK_KEY] = 1

		groups[ALL_GROUPS] = ALL_GROUPS_MAP
		groups[SELECTED_GROUPS] = selectedGroups  == null ? ALL_GROUPS_MAP.keySet() : selectedGroups
		groups[AVAILABLE_GROUPS_ALL_LEVELS] = [] as Set
		groups[GROUP_SUFFIX] = _ENUM

		scope = scope == null ? DEFAULT_SCOPE : scope
		stackInfo[TARGET_SCOPE] = scope

		NCube startCube = getCube(startCubeName)

		stackInfo[TARGET_CUBE] = startCube
		stack[stackInfo[STACK_KEY] ] = stackInfo

		while (!stack.isEmpty())
		{
			processCube()
		}

		trimSelectedLevel()
		trimSelectedGroups()
        String message = messages.size() > 0 ? messages.toString() : null

		return [startCube: startCube.name, groups: groups, levels: levels, scope:scope, nodes: nodes.toArray(), edges: edges.toArray(), message: message]
	}

	private void processCube()
	{
		stackInfo = (Map) stack.values().toArray()[0]
		stack.remove(stackInfo[STACK_KEY])

		if ((stackInfo[TARGET_CUBE] as NCube).name.startsWith(RPM_CLASS))
		{
			processClassCube()
		}
		else
		{
			processEnumCube()
		}
	}

	private void processClassCube()
	{
		NCube targetCube = stackInfo[TARGET_CUBE] as NCube
		Map targetScope = stackInfo[TARGET_SCOPE] as Map

		NCube sourceCube = stackInfo[SOURCE_CUBE] as NCube
		Map sourceTraitMaps = stackInfo[SOURCE_TRAIT_MAPS] as Map
		String sourceFieldName =  stackInfo[SOURCE_FIELD] as String
		Map sourceScope = stackInfo[SOURCE_SCOPE] as Map


		Map targetTraitMaps = stackInfo[TARGET_TRAIT_MAPS] as Map
		if (!targetTraitMaps) {
			targetTraitMaps = helper.getTraitMaps(targetCube.name, targetScope)
			stackInfo[TARGET_TRAIT_MAPS] = targetTraitMaps
		}

		String busType = getFormattedBusType(targetTraitMaps)

		long targetLevel = stackInfo[TARGET_LEVEL] as long
		addToEdges(targetCube, sourceCube, targetScope, sourceScope, targetTraitMaps, sourceTraitMaps, sourceFieldName, stackInfo[STACK_KEY] as long, targetLevel)

		String visitedKey = targetCube.name + targetScope.toString()
		if (visited.contains(visitedKey))
		{
			return
		}
		else
		{
			visited << visitedKey
		}

		(groups[AVAILABLE_GROUPS_ALL_LEVELS] as Set) << busType
		addToNodes(targetCube, targetScope, targetTraitMaps, targetLevel, busType, sourceFieldName)

		targetTraitMaps.each{ targetFieldName, targetTraits ->
			Boolean exists = targetTraits[R_EXISTS]
			if (!CLASS_TRAITS.equals(targetFieldName) && exists)
			{
				String targetFieldRpmType = targetTraits[R_RPM_TYPE]

				if (!helper.isPrimitive(targetFieldRpmType))
				{
					NCube nextTargetCube = null
					if ((targetTraits as Map).containsKey(V_ENUM))
					{
						nextTargetCube = getCube(RPM_ENUM_DOT + targetTraits[V_ENUM])
					}
					else if (targetFieldRpmType)
					{
						nextTargetCube = getCube(RPM_CLASS_DOT + targetFieldRpmType)
					}

					if (nextTargetCube)
					{
						addToStack(targetLevel, [:] as Map, nextTargetCube, targetFieldRpmType, targetFieldName as String)
					}
					else{
						messages << 'No cube exists with name of ' + RPM_ENUM_DOT + nextTargetCube.name + '. It is therefore not included in the visualization.'
					}
				}
			}
		}
	}

	private void processEnumCube ()
	{
		NCube targetCube = stackInfo[TARGET_CUBE] as NCube
		Map targetScope = stackInfo[TARGET_SCOPE] as Map
		String targetCubeName = targetCube.name

		NCube sourceCube =  stackInfo[SOURCE_CUBE] as NCube
		Map sourceTraitMaps = stackInfo[SOURCE_TRAIT_MAPS] as Map
		String sourceFieldName = stackInfo[SOURCE_FIELD] as String
		String sourceFieldRpmType =  stackInfo[SOURCE_FIELD_RPM_TYPE] as String
		Map sourceScope = stackInfo[SOURCE_SCOPE] as Map

		if (!targetCubeName.startsWith(RPM_ENUM)) {
			throw new IllegalStateException('Cube is not an rpm.enum cube: ' + targetCubeName +  '.')
		}

		if(sourceCube && (!sourceFieldRpmType || helper.isPrimitive(sourceFieldRpmType)))
		{
			return
		}

		long targetLevel = stackInfo[TARGET_LEVEL] as long

		Map targetTraitMaps = stackInfo[TARGET_TRAIT_MAPS] as Map
		if (!targetTraitMaps) {
			targetTraitMaps = helper.getTraitMaps(targetCube.name, targetScope)
			stackInfo[TARGET_TRAIT_MAPS] = targetTraitMaps
		}

		String busType = 'UNSPECIFIED'

		targetTraitMaps.each { targetFieldName, targetTraits ->
			Boolean exists = targetTraits[R_EXISTS]
			if (!CLASS_TRAITS.equals(targetFieldName) && exists)
			{
				try
				{
					String nextTargetCubeName = getNextTargetCubeName(targetCube, targetTraitMaps, sourceFieldRpmType, targetFieldName as String)

					if (nextTargetCubeName)
					{
						NCube nextTargetCube = getCube(RPM_CLASS_DOT + nextTargetCubeName)
						if (nextTargetCube)
						{
							Map nextTargetStackInfo = [:]
							addToStack(targetLevel, nextTargetStackInfo, nextTargetCube, sourceFieldRpmType, targetFieldName as String)

							if (busType == UNSPECIFIED) {
								busType = getFormattedBusType(nextTargetStackInfo[TARGET_TRAIT_MAPS] as Map)
							}
						}
						else{
							messages << 'No cube exists with name of ' + RPM_ENUM_DOT + nextTargetCubeName + '. It is therefore not included in the visualization.'
						}
					}
				}
				catch (Exception e)
				{
					throw new IllegalStateException('Exception caught while loading and processing the cube for enum field ' + targetFieldName + ' in enum ' + targetCube.name + '.', e)
				}
			}
		}


		addToEdges(targetCube, sourceCube, targetScope, sourceScope, targetTraitMaps, sourceTraitMaps, sourceFieldName, stackInfo[STACK_KEY] as long, targetLevel)

		String visitedKey = targetCube.name + targetScope.toString()
		if (visited.contains(visitedKey))
		{
			return
		}
		else
		{
			visited << visitedKey
		}

		(groups[AVAILABLE_GROUPS_ALL_LEVELS] as Set) << busType
		addToNodes(targetCube, targetScope, targetTraitMaps, targetLevel, busType, sourceFieldName)

	}

	private void trimSelectedLevel() {
		long nodeCount = levels[NODE_COUNT] as long
		long selectedLevel = levels[SELECTED_LEVEL] as long
		levels[SELECTED_LEVEL] = selectedLevel.compareTo(nodeCount) > 0 ? nodeCount.toString() : selectedLevel.toString()
	}

	private void trimSelectedGroups() {
		Iterable selected = groups[SELECTED_GROUPS] as Iterable
		Set available = groups[AVAILABLE_GROUPS_ALL_LEVELS] as Set
		groups[SELECTED_GROUPS] = available.intersect(selected).toArray()
		groups[AVAILABLE_GROUPS_ALL_LEVELS] = available.toArray()
	}

	private void addToStack(long targetLevel, Map nextTargetStackInfo, NCube nextTargetCube, String rpmType, String targetFieldName)
	{
		try
		{
			NCube nextSourceCube = stackInfo[TARGET_CUBE] as NCube
			nextTargetStackInfo[TARGET_CUBE] = nextTargetCube
			nextTargetStackInfo[TARGET_SCOPE] = getScopeRelativeToSource(nextTargetCube, rpmType, targetFieldName, stackInfo[TARGET_SCOPE] as Map)
			nextTargetStackInfo[TARGET_TRAIT_MAPS] =  helper.getTraitMaps(nextTargetCube.name, nextTargetStackInfo[TARGET_SCOPE] as Map)

			nextTargetStackInfo[SOURCE_CUBE] = nextSourceCube
			nextTargetStackInfo[SOURCE_SCOPE] = stackInfo[TARGET_SCOPE] as Map
			nextTargetStackInfo[SOURCE_TRAIT_MAPS] = stackInfo[TARGET_TRAIT_MAPS]
			nextTargetStackInfo[SOURCE_FIELD] = targetFieldName
			nextTargetStackInfo[SOURCE_FIELD_RPM_TYPE] = rpmType

			long nextTargetTargetLevel = targetLevel + 1
			nextTargetStackInfo[TARGET_LEVEL] = nextTargetTargetLevel

			long maxLevel = levels[MAX_LEVEL] as long
			levels[MAX_LEVEL] = maxLevel.compareTo(nextTargetTargetLevel) < 0 ? nextTargetTargetLevel : maxLevel
			levels[NODE_COUNT] = (levels[NODE_COUNT] as long) + 1
			nextTargetStackInfo[STACK_KEY] = levels[NODE_COUNT]
			stack[nextTargetStackInfo[STACK_KEY]] = nextTargetStackInfo
		}
		catch (Exception e)
		{
			throw new IllegalStateException('Exception caught while loading and processing the class for field ' + stackInfo[SOURCE_FIELD] + ' in class ' + nextTargetCube.name + '.', e)
		}
	}

	private static String getGroup(NCube cube, String busType)
	{
		if (cube.name.startsWith(RPM_ENUM))
		{
			return busType + _ENUM
		}
		else
		{
			return busType
		}
	}

	private static String getFormattedBusType(Map traitMaps)
	{
		String busType = getBusType(traitMaps)
		return busType == null ? UNSPECIFIED : busType.toUpperCase()
	}

	private void addToEdges(NCube targetCube, NCube sourceCube,  Map targetScope, Map sourceScope, Map targetTraitMaps, Map sourceTraitMaps, String sourceFieldName, long edgeId, long level )
	{
		if (!sourceCube)
		{
			return
		}

		Map edgeMap = [:]
		String sourceCubeEffectiveName = getEffectiveName(sourceCube, sourceTraitMaps)
		String targetCubeEffectiveName = getEffectiveName(targetCube, targetTraitMaps)
		edgeMap.id = edgeId.toString()
		edgeMap.from = sourceCube.name + '_' + sourceScope.toString()
		edgeMap.to = targetCube.name + '_' + targetScope.toString()
		edgeMap.fromName = sourceCubeEffectiveName
		edgeMap.toName = targetCubeEffectiveName
		edgeMap.fromFieldName = sourceFieldName
		edgeMap.level = level.toString()
		edgeMap.label = ''
		String vMin = sourceTraitMaps[sourceFieldName][V_MIN]
		String vMax = sourceTraitMaps[sourceFieldName][V_MAX]
		edgeMap.title = ''
		if (vMin != null && vMax != null) {
			edgeMap.title = vMin + ':' + vMax
		}
		else{
			edgeMap.title = ''
		}
		edges.add(edgeMap)
	}

	private void addToNodes(NCube targetCube, Map targetScope, Map traitMaps, long level, String busType, String sourceFieldName)
	{
		Map nodeMap = [:]
		nodeMap.id = targetCube.name + '_' + targetScope.toString()
		nodeMap.scope = targetScope.toString()
		nodeMap.level = level.toString()
		nodeMap.name = targetCube.name
		nodeMap.fromFieldName = sourceFieldName == null ? null : sourceFieldName

		nodeMap.label = getDotSuffix(getEffectiveName(targetCube, traitMaps))
		nodeMap.title = targetCube.name
		nodeMap.desc = getTitle(targetCube, getScopedName(traitMaps), targetScope, traitMaps, nodeMap)
		nodeMap.group = getGroup(targetCube, busType)
		nodes.add(nodeMap)
	}

	private String getTitle(NCube targetCube, String scopedName, Map scope, Map traitMaps, Map nodeMap)
	{
		StringBuilder sb = new StringBuilder()

		if (scopedName != null )
		{
			sb.append('<strong>scoped name = </strong>' + scopedName + '<br><br>')
		}

		sb.append('<strong>scope = </strong>' + scope.toString().replace('{','').replace('}','') + '<br><br>')

		String requiredScope = getRequiredScopeAllReferenced(targetCube).toString().replace('[','').replace(']','')
		sb.append(requiredScope == '' ? '' : '' + '<strong>required scope = </strong>' + requiredScope  + '<br><br>')

		String optionalScope = getOptionalScopeAllReferenced(targetCube).toString().replace('[','').replace(']','')
		sb.append(optionalScope == '' ? '' : '' + '<strong>optional scope = </strong>' + optionalScope  + '<br><br>')

		sb.append('<strong>level = </strong>' + nodeMap.level.toString() + '<br><br>')

		sb.append(getTitleFields(traitMaps))
		sb.append(getTitleClassTraits(traitMaps))

		return sb.toString();
	}


	private static String getTitleFields(Map traitMaps)
	{
		Map fields = getFields(traitMaps)
		String fieldString = "<strong>fields = </strong>";
		return fieldString + getFieldDetails(fields, SPACE)
	}


	private static String getFieldDetails(Map fields, String spaces)
	{
		StringBuilder fieldDetails = new StringBuilder()
		fieldDetails.append('')

		fields.each() { key, value ->

			fieldDetails.append('<br>' + spaces + key + SPACE)
		}

		return fieldDetails.toString();
	}

	private static String getTitleClassTraits(Map traitMaps)
	{
		StringBuilder traits = new StringBuilder()
		traits.append('<br><br><strong>class traits = </strong><br>')
		Map classTraits = traitMaps[CLASS_TRAITS] as Map
		classTraits.each { k,v ->
			String key = k as String
			String value = v as String
			if (!key.contains(CELL_INFO_SUFFIX))
			{
				traits.append(SPACE + key + ' = ' + value + '<br>')
			}
		}
		return traits.toString()
	}

	private static String getEffectiveName(NCube cube, Map traitMaps)
	{
		String scopedName = getScopedName(traitMaps)
		return scopedName == null ? cube.name : scopedName
	}

	private static String getScopedName(Map traitMaps)
	{
		String classTraitsTraitMap = traitMaps[CLASS_TRAITS]

		if (classTraitsTraitMap)
		{
			return traitMaps[CLASS_TRAITS][R_SCOPED_NAME]
		}

		return null
	}

	private static Map getFields(Map traitMaps)
	{
		Map fieldInfo = [:] as TreeMap
		traitMaps.each{ fieldName, traits ->
			Boolean exists = traits[R_EXISTS] as String
			if (!CLASS_TRAITS.equals(fieldName) && exists)
			{
				Map map = [:]
				map['traits'] = getTraits(traits as Map)
				fieldInfo[fieldName] = map
			}
		}
		return fieldInfo
	}

	private static String getTraits(Map traits)
	{
		StringBuilder traitInfo = new StringBuilder()
		traits.each{ traitName, traitValue ->
			if (!'null'.equals(traitValue))
			{
				traitInfo.append((traitName as String) + '=' + (traitValue as String))
				traitInfo.append(', ')
			}
		}
		String traitInfoString = traitInfo.toString()
		if (traitInfoString.endsWith(', '))
		{
			traitInfoString = traitInfoString.substring(0, traitInfoString.size() - 2)
		}

		return traitInfoString
	}

	private static String getNextTargetCubeName(NCube targetCube, Map traitsMap, String sourceFieldRpmType, String targetFieldName)
	{
		if (targetCube.getAxis('TRAIT').contains(R_SCOPED_NAME))
		{
			if (traitsMap[CLASS_TRAITS][R_SCOPED_NAME] == null)
			{
				return null
			}
			else
			{
				return sourceFieldRpmType
			}
		}

		return targetFieldName
	}

/**
 * Sets the basic scope required to load a target class based on scoped source class, source field name, target class name, and current scope.
 * Retains all other scope.
 * If the source class is not a scoped class, returns the scope unchanged.
 *
 * @param targetCube String target cube
 * @param targetTraitsMaps Map fields and traits of the target class
 * @param sourceTraitsMap Map fields and traits of the source class
 * @param sourceFieldName String source field name
 * @param scope Map<String, Object> scope
 *
 * @return Map new scope
 *
 */
	private static Map getScopeRelativeToSource(NCube targetCube, String sourceFieldRpmType, String targetFieldName, Map<String, Object> scope)
	{
		if (!targetCube.getAxis('TRAIT').contains(R_SCOPED_NAME))
		{
			return scope
		}

		Map<String, Object> newScope = new CaseInsensitiveMap<>(scope)

		if (targetCube.name.startsWith(RPM_ENUM))
		{
			newScope[SOURCE_FIELD_NAME] = targetFieldName
		}
		else
		{
			String newScopeKey = sourceFieldRpmType.toLowerCase()
			String oldValue = scope[newScopeKey]
			if (oldValue){
				newScope[SOURCE_SCOPE_KEY_PREFIX + sourceFieldRpmType] = oldValue
			}
			newScope[newScopeKey] = targetFieldName
		}

		return newScope
	}

	private static String getBusType(Map traitMaps)
	{
		Map traits = traitMaps[CLASS_TRAITS] as Map
		if (traits)
		{
			return traits[PD_BUS_TYPE]
		}

		return null
	}

	private static String getDotSuffix(String value)
	{
		if (value.lastIndexOf('.') == -1) {
			return value
		}

		return value.substring(value.lastIndexOf('.') + 1);
	}

	private Map checkMissingScope(String cubeName, Map scope ) {
		Set missingScope = findMissingScope(cubeName, scope)
		if (missingScope) {
			Map expandedScope = scope == null ? new CaseInsensitiveMap(DEFAULT_SCOPE) : new CaseInsensitiveMap(scope)
			String missingScopeString = ''
			missingScope.each {
				expandedScope[it] = '????'
				missingScopeString = missingScopeString + it + ', '
			}
			missingScopeString = missingScopeString.substring(0, missingScopeString.size() - 2)
			String message = 'Loading the visualization for ' + cubeName + ' requires additional scope to be provided. Please add scope value(s) for the following scope key(s): ' + missingScopeString + '.'
			return [message: message, scope: expandedScope]
		}
		return null
	}

	private Set findMissingScope(String startCubeName, Map scope) {
		NCube startCube = getCube(startCubeName)

		Set<String> requiredScope = getRequiredScopeAllReferenced(startCube)
		Set missingScope = []
		requiredScope.each {
			if (scope == null || !scope.containsKey(it)) {
				missingScope << it
			}
		}

		return missingScope.size() > 0 ? missingScope : null
	}

	private Set getRequiredScopeAllReferenced(NCube startCube) {
		Set requiredScope = getRequiredScope(startCube)
		startCube.getReferencedCubeNames().each {
			NCube refCube = getCube(it)
			requiredScope.addAll(getRequiredScope(refCube))
		}
		requiredScope
	}

	private Set getOptionalScopeAllReferenced(NCube startCube) {
		Set optionalScope = startCube.getOptionalScope([:] as Map, [:] as Map)
		startCube.getReferencedCubeNames().each {
			NCube refCube = getCube(it)
			optionalScope.addAll(refCube.getOptionalScope([:] as Map, [:] as Map))
		}
		optionalScope
	}

	private static Set getRequiredScope(NCube cube)
	{
		Set<String> requiredScope = cube.getRequiredScope([:] as Map, [:] as Map)

		requiredScope.remove(AXIS_FIELD);
		requiredScope.remove(AXIS_NAME);
		requiredScope.remove(AXIS_TRAIT);
		return requiredScope;
	}
}