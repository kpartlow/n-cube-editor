package com.cedarsoftware.util

import com.cedarsoftware.ncube.NCube
import com.cedarsoftware.ncube.NCubeManager
import com.cedarsoftware.util.io.JsonWriter
import groovy.transform.CompileStatic
import ncube.grv.exp.NCubeGroovyExpression

import java.text.Collator

/**
 * Creates the json used to create a visualization of the rpm cubes associated with a given rpm cube.
 */

@CompileStatic
class Visualizer extends NCubeGroovyExpression
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

	private VisualizerHelper helper = new VisualizerHelper()

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
	def run()
	{
		Map options = input.options as Map
		String startCubeName = options.startCubeName as String
		Object[] selectedGroups = options.selectedGroups as Object[]
		String selectedLevel = options.selectedLevel as String
		Map scope = options.scope as Map
		helper.ncube = ncube

		try {
			//TODO: This is a temp location for checking scope. Move check for scope to where traitMaps are obtained.
			//TODO: Also handle the user adding the required scope key but with a value that results in a no hit.
			Map map = checkMissingScope(startCubeName, scope)
			if (map) {
				return JsonWriter.objectToJson(status: 'missingScope', message: map.message, scope: map.scope)
			}

			map = getRpmVisualizationMap(startCubeName, scope, selectedGroups, selectedLevel)

			return JsonWriter.objectToJson([status: 'success', map: map, message: map.message])
		}
		catch (Exception e){
			throw e
		}
	}

	private Map getRpmVisualizationMap(String startCubeName, Map scope, Object[] selectedGroups, String selectedLevel)
	{
		Map stack = [:]
		Map stackInfo = [:]
		Set visited = []
		List nodes = []
		List edges = []
		Map levels = [:]
		Map groups = [:]
		List messages = []

		levels[MAX_LEVEL] = 1
		levels[NODE_COUNT] = 1
		levels[SELECTED_LEVEL] = selectedLevel == null ? DEFAULT_LEVEL :  Integer.parseInt(selectedLevel)
		stackInfo[TARGET_LEVEL] = 1
		stackInfo[STACK_KEY] = 1

		groups[ALL_GROUPS] = ALL_GROUPS_MAP
		groups[SELECTED_GROUPS] = selectedGroups  == null ? ALL_GROUPS_MAP.keySet().toArray() : selectedGroups
		groups[AVAILABLE_GROUPS_ALL_LEVELS] = [] as Set
		groups[GROUP_SUFFIX] = _ENUM

		scope = scope == null ? DEFAULT_SCOPE : scope
		stackInfo[TARGET_SCOPE] = scope

		NCube startCube = NCubeManager.getCube(applicationID, startCubeName)

		stackInfo[TARGET_CUBE] = startCube
		stack[stackInfo[STACK_KEY] ] = stackInfo

		while (!stack.isEmpty())
		{
			processCube(stack, visited, nodes, edges, groups, levels, messages)
		}

		trimSelectedLevel(levels)
		trimSelectedGroups(groups)
        String message = messages.size() > 0 ? messages.toString() : null

		return [startCube: startCube.name, networkOptions:getNetworkOptions(), groups: groups, levels: levels, scope:scope, nodes: nodes.toArray(), edges: edges.toArray(), message: message]
	}

	private void processCube(Map stack, Set visited, List nodes, List edges, Map groups, Map levels, List messages)
	{
		Map stackInfo= (Map) stack.values().toArray()[0]
		stack.remove(stackInfo[STACK_KEY])

		if ((stackInfo[TARGET_CUBE] as NCube).name.startsWith(RPM_CLASS))
		{
			processClassCube(stack, stackInfo, visited, nodes, edges, groups, levels, messages)
		}
		else
		{
			processEnumCube(stack, stackInfo, visited, nodes, edges, groups, levels, messages)
		}
	}

	private void processClassCube(Map stack, Map stackInfo, Set visited, List nodes, List edges, Map groups, Map levels, List messages)
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

		if (!targetCube.name.startsWith(RPM_CLASS)) { //TODO: Can be removed if no exceptions occur
				throw new Exception('Cube is not an rpm.class: name = ' + targetCube.name +  '.')
		}

		String busType = getFormattedBusType(targetTraitMaps)

		Integer targetLevel = stackInfo[TARGET_LEVEL] as Integer
		addToEdges(targetCube, sourceCube, targetScope, sourceScope, targetTraitMaps, sourceTraitMaps, sourceFieldName, edges, stackInfo[STACK_KEY] as Integer, targetLevel)

		if (hasVisited(visited, targetCube.sha1() + targetScope.toString()))
		{
			return
		}

		(groups[AVAILABLE_GROUPS_ALL_LEVELS] as Set) << busType
		addToNodes(targetCube, targetScope, targetTraitMaps, targetLevel, nodes, busType, sourceFieldName)

		targetTraitMaps.each{ targetFieldName, targetTraits ->
			String exists = targetTraits[R_EXISTS]
			if (!CLASS_TRAITS.equals(targetFieldName) && exists && exists.toBoolean())
			{
				String targetFieldRpmType = targetTraits[R_RPM_TYPE]

				if (!helper.isPrimitive(targetFieldRpmType))
				{
					NCube nextTargetCube = null
					if ((targetTraits as Map).containsKey(V_ENUM))
					{
						nextTargetCube = NCubeManager.getCube(applicationID, RPM_ENUM_DOT + targetTraits[V_ENUM])
					}
					else if (targetFieldRpmType)
					{
						nextTargetCube = NCubeManager.getCube(applicationID, RPM_CLASS_DOT + targetFieldRpmType)
					}

					if (nextTargetCube)
					{
						addToStack(targetLevel, levels, stack, stackInfo, [:] as Map, nextTargetCube, targetFieldRpmType, targetFieldName as String, messages)
					}
					else{
						messages << 'No cube exists with name of ' + RPM_ENUM_DOT + nextTargetCube.name + '. It is therefore not included in the visualization.'
					}
				}
			}
		}
	}

	private void processEnumCube (Map stack, Map stackInfo, Set visited, List nodes, List edges, Map groups, Map levels, List messages)
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
			throw new Exception('Cube is not an rpm.enum cube: ' + targetCubeName +  '.')
		}

		if(sourceCube && (!sourceFieldRpmType || helper.isPrimitive(sourceFieldRpmType)))
		{
			return
		}

		Integer targetLevel = stackInfo[TARGET_LEVEL] as Integer

		Map targetTraitMaps = stackInfo[TARGET_TRAIT_MAPS] as Map
		if (!targetTraitMaps) {
			targetTraitMaps = helper.getTraitMaps(targetCube.name, targetScope)
			stackInfo[TARGET_TRAIT_MAPS] = targetTraitMaps
		}

		String busType = 'UNSPECIFIED'

		targetTraitMaps.each { targetFieldName, targetTraits ->
			String exists = targetTraits[R_EXISTS]
			if (!CLASS_TRAITS.equals(targetFieldName) && exists && exists.toBoolean())
			{
				try
				{
					String nextTargetCubeName = getNextTargetCubeName(targetCube, targetTraitMaps, sourceFieldRpmType, targetFieldName as String)

					if (nextTargetCubeName)
					{
						NCube nextTargetCube = NCubeManager.getCube(applicationID, RPM_CLASS_DOT + nextTargetCubeName)
						if (nextTargetCube)
						{
							Map nextTargetStackInfo = [:]
							addToStack(targetLevel, levels, stack, stackInfo, nextTargetStackInfo, nextTargetCube, sourceFieldRpmType, targetFieldName as String, messages)

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
					throw new Exception('Exception caught while loading and processing the cube for enum field ' + targetFieldName + ' in enum ' + targetCube.name + '. ' + e.message, e)
				}
			}
		}


		addToEdges(targetCube, sourceCube, targetScope, sourceScope, targetTraitMaps, sourceTraitMaps, sourceFieldName, edges, stackInfo[STACK_KEY] as Integer, targetLevel)

		if (hasVisited(visited, targetCube.sha1() + targetScope.toString()))
		{
			return
		}

		(groups[AVAILABLE_GROUPS_ALL_LEVELS] as Set) << busType
		addToNodes(targetCube, targetScope, targetTraitMaps, targetLevel, nodes, busType, sourceFieldName)

	}

	private void trimSelectedLevel(Map levels) {
		Integer nodeCount = levels[NODE_COUNT] as Integer
		Integer selectedLevel = levels[SELECTED_LEVEL] as Integer
		levels[SELECTED_LEVEL] = selectedLevel.compareTo(nodeCount) > 0 ? nodeCount.toString() : selectedLevel.toString()
	}

	private static void trimSelectedGroups(Map groups) {
		List availableSelectedGroups = []
		List selectedGroups = groups[SELECTED_GROUPS] as List
		groups[AVAILABLE_GROUPS_ALL_LEVELS].each() {
			if (selectedGroups.contains(it)) {
				availableSelectedGroups << it
			}
		}
		groups[SELECTED_GROUPS] = availableSelectedGroups.toArray()
		groups[AVAILABLE_GROUPS_ALL_LEVELS] = (groups[AVAILABLE_GROUPS_ALL_LEVELS] as Set).toArray()
	}

	private void addToStack(Integer targetLevel, Map levels,  Map stack,  Map stackInfo, Map nextTargetStackInfo, NCube nextTargetCube, String rpmType, String targetFieldName, List messages)
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

			Integer nextTargetTargetLevel = targetLevel + 1
			nextTargetStackInfo[TARGET_LEVEL] = nextTargetTargetLevel

			Integer maxLevel = levels[MAX_LEVEL] as Integer
			levels[MAX_LEVEL] = maxLevel.compareTo(nextTargetTargetLevel) < 0 ? nextTargetTargetLevel : maxLevel
			levels[NODE_COUNT] = (levels[NODE_COUNT] as Integer) + 1
			nextTargetStackInfo[STACK_KEY] = levels[NODE_COUNT]
			stack[nextTargetStackInfo[STACK_KEY]] = nextTargetStackInfo
		}
		catch (Exception e)
		{
			throw new Exception('Exception caught while loading and processing the class for field ' + stackInfo[SOURCE_FIELD] + ' in class ' + nextTargetCube.name + '. ' + e.message, e)
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

	private
	static void addToEdges(NCube targetCube, NCube sourceCube,  Map targetScope, Map sourceScope, Map targetTraitMaps, Map sourceTraitMaps, String sourceFieldName, List edges, Integer edgeId, Integer level )
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

	private void addToNodes(NCube targetCube, Map targetScope, Map traitMaps, Integer level, List nodes, String busType, String sourceFieldName)
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
		StringBuffer fieldDetails = new StringBuffer()
		fieldDetails.append('')

		fields.each() { key, value ->

			fieldDetails.append('<br>' + spaces + key + SPACE)
		}

		return fieldDetails.toString();
	}

	private static String getTitleClassTraits(Map traitMaps)
	{
		StringBuffer traits = new StringBuffer()
		traits.append('<br><br><strong>class traits = </strong><br>')

		List classTraitMap = getClassTraits(traitMaps)
		classTraitMap.each(){
			String traitt = it as String
			if (!traitt.contains(CELL_INFO_SUFFIX)) {
				traits.append(SPACE + traitt + '<br>')
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
		Map fieldInfo = [:]
		traitMaps.each{ fieldName, traits ->
			String exists = traits[R_EXISTS] as String
			if (!CLASS_TRAITS.equals(fieldName) && exists && exists.toBoolean())
			{
				Map map = [:]
				map['traits'] = getTraits(traits as Map)
				fieldInfo[fieldName] = map
			}
		}

		Map sortedMap = fieldInfo.sort{it}
		return sortedMap
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

	private static List getClassTraits(Map traitMaps)
	{
		Map traits = traitMaps[CLASS_TRAITS] as Map
		List traitsList = [] as List
		traits.each() { k, v -> traitsList << (k as String) + " = " + (v as String) }
		traitsList.removeAll { (it as List).contains('null')}
		List sortedList =  traitsList.toArray().sort(false, Collator.instance) as List
		return sortedList
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
			String newScopeKey = getDotSuffix(sourceFieldRpmType).toLowerCase()
			newScope[newScopeKey] = targetFieldName
		}

		return newScope
	}

	private static Map getNetworkOptions()
	{
		//TODO: This could be placed into a cube

		Map options =
				[
						height: '100%',
						nodes:
								[
										scaling: [
												min: 16,
												max: 32
										]
								],
						edges:
								[
										arrows: 'to',
										color: 'gray',
										smooth: false,
										hoverWidth: 3
								],
						physics:
								[
										barnesHut: [gravitationalConstant: -30000],
										stabilization: [iterations: 2500],
								],
						layout:
								[
										hierarchical: false,
										improvedLayout : true,
										randomSeed:2
								],
						groups:
								[
										PRODUCT:
												[
														shape: 'box',
														color: '#FF9900' // orange
												],
										RISK:
												[
														shape: 'square',
														color: "#5A1E5C" // purple
												],
										COVERAGE:
												[
														shape: 'star',
														color: "#dbe92b" // yellow
												],
										CONTAINER:
												[
														shape: 'star',
														color: "#731d1d" // dark red
												],
										LIMIT:
												[
														shape: 'diamond',
														color: "#C5000B" // red
												],
										DEDUCTIBLE:
												[
														shape: 'diamond',
														color: "#ffc0cb " // pink
												],
										PREMIUM:
												[
														shape: 'ellipse',
														color: "#2be998" // green
												],
										RATE:
												[
														shape: 'ellipse',
														color: "#2B7CE9" // blue
												],
										RATEFACTOR:
												[
														shape: 'ellipse',
														color: "#2bdbe9" // light blue
												],
										PARTY:
												[
														shape: 'box',
														color: '#99b299' // light green
												],
										PLACE:
												[
														shape: 'box',
														color: '#cdbbce' // light purple
												],
										FORM:
												[
														shape: 'box',
														color: '#cdbbce' // light purple
												],
										FORMDATA:
												[
														shape: 'box',
														color: '#cdbbce' // light purple
												],
										UNSPECIFIED:
												[
														shape: 'box',
														color: '#cdbbce' // light purple
												],
										PRODUCT_ENUM :
												[
														shape: 'dot',
														color: 'gray'   // gray
												],
										RISK_ENUM :
												[
														shape: 'dot',
														color: 'gray'   // gray
												],
										COVERAGE_ENUM :
												[
														shape: 'dot',
														color: 'gray'   // gray
												],
										LIMIT_ENUM :
												[
														shape: 'dot',
														color: 'gray'   // gray
												],
										PREMIUM_ENUM :
												[
														shape: 'dot',
														color: 'gray'   // gray
												],
										RATE_ENUM :
												[
														shape: 'dot',
														color: 'gray'   // gray
												],
										RATEFACTOR_ENUM :
												[
														shape: 'dot',
														color: 'gray'   // gray
												],
										CONTAINER_ENUM:
												[
														shape: 'dot',
														color: 'gray'   // gray
												],
										DEDUCTIBLE_ENUM:
												[
														shape: 'dot',
														color: 'gray'   // gray
												],
										PARTY_ENUM:
												[
														shape: 'dot',
														color: 'gray'   // gray
												],
										PLACE_ENUM:
												[
														shape: 'dot',
														color: 'gray'   // gray
												],
								]
				];
		return options
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

	private static boolean hasVisited(Set visited, String visitedKey)
	{
		if (visited.contains(visitedKey))
		{
			return true
		}

		visited << visitedKey
		return false
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
		NCube startCube = NCubeManager.getCube(applicationID, startCubeName)

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
			NCube refCube = NCubeManager.getCube(applicationID, it)
			requiredScope.addAll(getRequiredScope(refCube))
		}
		requiredScope
	}

	private Set getOptionalScopeAllReferenced(NCube startCube) {
		Set optionalScope = startCube.getOptionalScope([:] as Map, [:] as Map)
		startCube.getReferencedCubeNames().each {
			NCube refCube = NCubeManager.getCube(applicationID, it)
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