package com.cedarsoftware.util

import com.cedarsoftware.ncube.ApplicationID
import com.cedarsoftware.ncube.NCube
import com.cedarsoftware.ncube.NCubeManager
import com.google.common.base.Joiner
import groovy.transform.CompileStatic

import static com.cedarsoftware.util.VisualizerConstants.*

/**
 * Provides information to visualize n-cubes.
 */

@CompileStatic
class Visualizer
{
	protected ApplicationID appId
	protected Set<String> visited = []
	protected Deque<VisualizerRelInfo> stack = new ArrayDeque<>()
	protected Joiner.MapJoiner mapJoiner = Joiner.on(", ").withKeyValueSeparator(": ")
	VisualizerHelper helper

	/**
	 * Processes an n-cube and all its referenced n-cubes and provides information to
	 * visualize the cubes and their relationships.
	 *
	 * @param applicationID
	 * @param options - a map containing:
	 *           String startCubeName, name of the starting cube
	 *           Map scope, the context for which the visualizer is loaded
	 *           VisualizerInfo visInfo, information about the visualization
	 * @return a map containing:
	 *           String status, status of the visualization
	 *           VisualizerInfo visInfo, information about the visualization
	 */
	Map<String, Object> buildGraph(ApplicationID applicationID, Map options)
	{
		appId = applicationID
		String startCubeName = options.startCubeName as String
		VisualizerInfo visInfo = getVisualizerInfo(options)

		if (!isValidStartCube(visInfo, startCubeName))
		{
			visInfo.convertToSingleMessage()
			return [status: STATUS_INVALID_START_CUBE, visInfo: visInfo]
		}

		if (hasMissingMinimumScope(visInfo, startCubeName))
		{
			visInfo.convertToSingleMessage()
			return [status: STATUS_MISSING_START_SCOPE, visInfo: visInfo]
		}

		getVisualization(visInfo, startCubeName)

		visInfo.convertToSingleMessage()
		return [status: STATUS_SUCCESS, visInfo: visInfo]
	}

	/**
	 * Loads all cell values for a cube given the scope provided.
	 *
	 * @param applicationID
	 * @param options - a map containing:
	 *            Map node, representing a cube and its scope
	 *            VisualizerInfo visInfo, information about the visualization
	 * @return a map containing:
	 *           String status, status of the visualization
	 *           VisualizerInfo visInfo, information about the visualization
	 */
	Map getCellValues(ApplicationID applicationID, Map options)
	{
		appId = applicationID
		VisualizerRelInfo relInfo = new VisualizerRelInfo(appId, options.node as Map)
		return getCellValues(relInfo, options)
	}

	protected static Map getCellValues(VisualizerRelInfo relInfo, Map options)
	{
		VisualizerInfo visInfo = options.visInfo as VisualizerInfo
		visInfo.scopeInfo = new VisualizerScopeInfo()
		visInfo.messages = new LinkedHashSet()
		Map node = options.node as Map

		relInfo.loadCellValues(visInfo)
		node.details = relInfo.getDetails(visInfo)
		node.showCellValuesLink = relInfo.showCellValuesLink
		node.cellValuesLoaded = relInfo.cellValuesLoaded
		boolean showCellValues = relInfo.showCellValues
		node.showCellValues = showCellValues
		visInfo.nodes = [node]
		visInfo.convertToSingleMessage()
		return [status: STATUS_SUCCESS, visInfo: visInfo]
	}

	protected VisualizerInfo getVisualizerInfo(Map options)
	{
		VisualizerInfo visInfo = options.visInfo as VisualizerInfo
		if (!visInfo || visInfo.class.name != this.class.name)
		{
			visInfo = new VisualizerInfo(appId, options)
		}
		visInfo.init(options.scope as Map)
		return visInfo
	}

	protected void getVisualization(VisualizerInfo visInfo, String startCubeName)
	{
		VisualizerRelInfo relInfo = visualizerRelInfo
		loadFirstVisualizerRelInfo(visInfo, relInfo, startCubeName)
		stack.push(relInfo)

		while (!stack.empty)
		{
			processCube(visInfo, stack.pop())
		}

		handleUnboundAxes(visInfo)
	}

	protected void handleUnboundAxes(VisualizerInfo visInfo)
	{
		if (visInfo.scopeInfo.axisNames)
		{
			StringBuilder sb = new StringBuilder('Since not all optional scope was provided or found, one or more defaults were used to load the graph.')
			sb.append("${BREAK}")
			sb.append(getVisualizerHelper().handleUnboundAxes(visInfo.scopeInfo))
			visInfo.messages << sb.toString()
		}
	}

	protected void loadFirstVisualizerRelInfo(VisualizerInfo visInfo, VisualizerRelInfo relInfo, String startCubeName)
	{
		relInfo.appId = appId
		relInfo.targetCube = NCubeManager.getCube(appId, startCubeName)
		relInfo.scope = new CaseInsensitiveMap(visInfo.scope)
		relInfo.targetLevel = 1
		relInfo.targetId = 1
		relInfo.addRequiredAndOptionalScopeKeys(visInfo)
		relInfo.targetScope = new CaseInsensitiveMap()
		relInfo.showCellValuesLink = true
	}

	protected void processCube(VisualizerInfo visInfo, VisualizerRelInfo relInfo)
	{
		NCube targetCube = relInfo.targetCube
		String targetCubeName = targetCube.name

		if (relInfo.sourceCube)
		{
			visInfo.edges << relInfo.createEdge(visInfo.edges.size())
		}

		if (!visited.add(targetCubeName + relInfo.scope.toString()))
		{
			return
		}

		visInfo.nodes << relInfo.createNode(visInfo)

		Map<Map, Set<String>> refs = targetCube.referencedCubeNames

		refs.each {Map coordinates, Set<String> cubeNames ->
			cubeNames.each { String cubeName ->
				addToStack(visInfo, relInfo, new VisualizerRelInfo(), cubeName, coordinates)
			}
		}
	}

	protected void addToStack(VisualizerInfo visInfo, VisualizerRelInfo relInfo, VisualizerRelInfo nextRelInfo, String nextTargetCubeName, Map coordinates = [:])
	{
		NCube nextTargetCube = NCubeManager.getCube(appId, nextTargetCubeName)
		if (nextTargetCube)
		{
				nextRelInfo.appId = appId
				long nextTargetLevel = relInfo.targetLevel + 1
				nextRelInfo.targetLevel = nextTargetLevel
				visInfo.relInfoCount += 1
				nextRelInfo.targetId = visInfo.relInfoCount
				nextRelInfo.targetCube = nextTargetCube
				nextRelInfo.sourceCube = relInfo.targetCube
				nextRelInfo.sourceScope = new CaseInsensitiveMap(relInfo.targetScope)
				nextRelInfo.sourceId = relInfo.targetId
				nextRelInfo.sourceFieldName = mapJoiner.join(coordinates)
				nextRelInfo.targetScope = new CaseInsensitiveMap(coordinates)
				nextRelInfo.scope = new CaseInsensitiveMap(relInfo.scope)
				nextRelInfo.scope.putAll(coordinates)
				nextRelInfo.addRequiredAndOptionalScopeKeys(visInfo)
				nextRelInfo.showCellValuesLink = true
				stack.push(nextRelInfo)
		}
		else
		{
			visInfo.messages << "No cube exists with name of ${nextTargetCubeName}. Cube not included in the visualization.".toString()
		}
	}

	protected VisualizerRelInfo getVisualizerRelInfo()
	{
		return new VisualizerRelInfo()
	}

	protected VisualizerHelper getVisualizerHelper()
	{
		helper =  new VisualizerHelper()
	}

	protected boolean isValidStartCube(VisualizerInfo visInfo, String cubeName)
	{
		return true
	}

	protected boolean hasMissingMinimumScope(VisualizerInfo visInfo, String startCubeName)
	{
		return false
	}
}