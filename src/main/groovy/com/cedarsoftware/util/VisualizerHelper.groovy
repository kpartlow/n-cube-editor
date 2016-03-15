package com.cedarsoftware.util

import com.cedarsoftware.ncube.*
import com.cedarsoftware.ncube.exception.CoordinateNotFoundException
import groovy.transform.CompileStatic
import ncube.grv.method.NCubeGroovyController

import java.util.regex.Matcher
import java.util.regex.Pattern

/**
 * The methods in this class are used by the n-cube-editor for tooling work related to the rpm.
 * The methods are are copied from Dynamis unless otherwise is indicated.
 * Do find on 'COPIED' to find code copied from Dynamis.
 * Do find on 'MODIFIED' to find modifications to copied Dynamis code.
 * Do find on 'ORIGINAL' to find code not copied from Dynamis.
 *
 */

@CompileStatic
public class VisualizerHelper extends NCubeGroovyController {

	/**
	 * ORIGINAL: Not copied from Dynamis
	 */
	public static final String FIELD_AXIS = "field";
	public static final String TRAIT_AXIS = "trait";
	public static final String ENUM_NAME_AXIS = "name";
	public static final String RPM_CLASS = "rpm.class";
	public static final String RPM_ENUM = "rpm.enum";
	public static final String RPM_CLASS_DOT = 'rpm.class.'
	public static final String RPM_ENUM_DOT = 'rpm.enum.'
	public static final String R_EXTENDS = 'r:extends'
	public static final String CLASS_TRAITS = 'CLASS_TRAITS'
	public static final String CELL_INFO_SUFFIX = '_CELL_INFO'

	/** pattern to match valid class names: names must start with letter (a-z), but allow numbers (1-9) and underscore (_). Class names are also allowed to include package name (x.y.z)
	 *  COPIED: Copied from Dynamis
	 */
	public static
	final Pattern PATTERN_CLASS_NAME = Pattern.compile('^(?:[a-z][a-z0-9_]*)(?:\\.[a-z][a-z0-9_]*)*$', Pattern.CASE_INSENSITIVE);

	/** pattern to match comma-delimited classnames (class names within value will be validated individually against PATTERN_CLASS_NAME)
	 *  COPIED: Copied from Dynamis
	 */
	public static
	final Pattern PATTERN_CLASS_EXTENDS_TRAIT = Pattern.compile('[^,\\s][^\\,]*[^,\\s]*', Pattern.CASE_INSENSITIVE);

	/** pattern to match r:extends trait on fields
	 *  COPIED: Copied from Dynamis
	 */
	public static
	final Pattern PATTERN_FIELD_EXTENDS_TRAIT = Pattern.compile('^\\s*((?:[a-z][a-z0-9_]*)(?:\\.[a-z][a-z0-9_]*)*)\\s*(?:[\\[]\\s*([a-z0-9_]+?)\\s*[\\]])?\\s*$', Pattern.CASE_INSENSITIVE);

	/** COPIED: Copied from Dynamis
	 */
	public static final String RPM_META = "rpm.meta.traits.category";

	/**
	 * COPIED: Copied from Dynamis
	 */
	public boolean isPrimitive(String type) {
		for (PRIMITIVE_TYPE pt : PRIMITIVE_TYPE.values()) {
			if (pt.getClassType().getSimpleName().equalsIgnoreCase(type)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * ORIGINAL: Not copied from Dynamis
	 */
	public Map getTraitMaps(String cubeName, Map scope) {
		Set excludedClasses = input?.excludedClasses == null ? [] as Set : input.excludedClasses as Set
		NCube cube = getCube(cubeName)
		Map traitMaps = [:]
		if (cube.name.startsWith(RPM_ENUM)) {
			loadRpmClassFields(RPM_ENUM, cube.name.split(RPM_ENUM_DOT)[1], scope, traitMaps,excludedClasses)
		} else {
			loadRpmClassFields(RPM_CLASS, cube.name.split(RPM_CLASS_DOT)[1], scope, traitMaps, excludedClasses)
		}

		return traitMaps
	}

	/**
	 * pulls all of the fields and associated traits from nCube that will be used to create the RpmClass/RpmEnum instance
	 * COPIED: Copied from Dynamis
	 */
	private void loadRpmClassFields(String cubeType, String cubeName, Map<String, Object> scope, Map<String,Map<String,Object>> traitMaps, Set excludedClasses)
	{
		LinkedList<String> classesToProcess = new LinkedList<String>();
		Set<String> visited = new LinkedHashSet<String>();

		// loop through class hierarchy until all classes in the r:extends chain have been handled
		boolean isOriginalClass = true;
		classesToProcess.add(cubeName);
		while (!classesToProcess.isEmpty())
		{
			String className = classesToProcess.pop();

			//MODIFIED: Added logic to exclude specific classes
			if (excludedClasses.contains(className)) {
				continue;
			}

			// don't allow cycles
			if (visited.contains(className))
			{
				continue;
			}
			visited.add(className);

			try
			{
				loadFieldTraitsForClass(cubeType, className, scope, traitMaps, classesToProcess);
				if(isOriginalClass)
				{
					for(Map.Entry<String,Map<String,Object>> entry : traitMaps.entrySet())
					{
						if(!"CLASS_TRAITS".equals(entry.getKey()))
						{
							entry.getValue().put("r:declared", true);
						}
					}
				}
				isOriginalClass = false;
			}
			catch (Exception e)
			{
				// to help with debugging issues related to classes using mixins, dump the list of classes processed thus far
				StringBuilder msg = new StringBuilder();
				msg.append("Failed to load " + (cubeType==RPM_CLASS ? "RpmClass" : "RpmEnum") + "='");
				msg.append(className);
				msg.append("'");
				if (visited.size()>1)
				{
					msg.append(", classes processed=");
					msg.append(Arrays.toString(visited.toArray()));
				}
				throw new Exception( msg.toString(), e);
			}
		} // end class stack
	}

	/**
	 * Populates the field traits for the class or enum
	 * COPIED: Copied from Dynamis
	 */
	private void loadFieldTraitsForClass(String cubeType, String className, Map<String, Object> scope, Map<String,Map<String,Object>> traitMaps, LinkedList<String> classesToProcess)
	{
		String axisName = RPM_ENUM.equals(cubeType) ? ENUM_NAME_AXIS : FIELD_AXIS;

		// MODIFIED: Removed scope argument. Not performing scope check here.
		NCube ncube = findClassCube(cubeType, className);
		if (ncube == null)
		{
			String classType = cubeType==RPM_CLASS ? "RpmClass" : "RpmEnum";
			throw new IllegalArgumentException(classType + " definition not found for identifier='" + className + "'");
		}

		List<Column> fields = ncube.getAxis(axisName).getColumns();
		for (Column field : fields)
		{
			String fieldName = (String) field.getValue();
			Map<String, Object> traits = traitMaps.get(fieldName);
			if (traits==null)
			{
				traits = new LinkedHashMap<String, Object>();
				traitMaps.put(fieldName, traits);
			}

			Map<String, Object> traitCells = mergeFieldTraits(fieldName, ncube,	axisName, scope, traits);

			//MODIFIED: Use local R_EXTENDS constant
			Object extendsValue = traitCells.get(R_EXTENDS);
			if (extendsValue!=null)
			{
				//MODIFIED: Use local CLASS_TRAITS constant
				if (CLASS_TRAITS.equals(fieldName))
				{
					processClassMixins(className, extendsValue.toString(), classesToProcess);
				}
				else
				{
					processMasterDefinition(className, fieldName, extendsValue.toString(), cubeType, axisName, scope, traits);
				}
			}
		}
	}


	/**
	 * applies the master definition specified in r:extends to the current field traits
	 * COPIED: Copied from Dynamis
	 */
	private void processMasterDefinition(String className, String fieldName, String masterDefinition,
										 String cubeType, String axisName, Map<String, Object> scope, Map<String, Object> traits)
	{
		String classType = cubeType==RPM_CLASS ? "RpmClass" : "RpmEnum";
		LinkedList<String> defsToProcess = new LinkedList<String>();
		Set<String> visited = new HashSet<String>();	// list of visited definitions pulled from traits using class_name or class_name[field_name] format
		Set<String> fqVisited = new HashSet<String>();	// list of visited definitions which have been fully qualified, e.g. class_name[field_name]
		final String exceptionFormat = "%s for field='%s' of %s='%s': definition(s)='%s'";

		defsToProcess.add(masterDefinition);
		while (!defsToProcess.isEmpty()) {
			String fieldToMerge = defsToProcess.pop();
			visited.add(fieldToMerge);

			Matcher m = PATTERN_FIELD_EXTENDS_TRAIT.matcher(fieldToMerge);
			if (!m.matches())
			{
				throw new IllegalArgumentException(String.format(exceptionFormat, "Invalid master definition format used", fieldName,
						classType, className, Arrays.toString(visited.toArray())));
			}

			// determine the master definition to use
			String masterClass = m.group(1);
			String masterField = StringUtilities.isEmpty(m.group(2)) ? fieldName : m.group(2);
			String fqMasterDef = masterClass + "[" + masterField + "]";	// fully qualified master definition

			// make sure class hasn't already been processed
			if (fqVisited.contains(fqMasterDef))
			{
				continue;
			}
			fqVisited.add(fqMasterDef);

			// make sure the class definition exists
			// MODIFIED: Removed scope argument. Not performing scope check here.
			NCube masterCube = findClassCube(cubeType, masterClass);
			if (masterCube == null)
			{
				throw new IllegalArgumentException(String.format(exceptionFormat, "Class in master definition not found", fieldName,
						classType, className, Arrays.toString(visited.toArray())));
			}

			// validate the field name
			boolean validField = false;
			for (Column col : masterCube.getAxis(axisName).getColumns()) {
				if (col.getValue().equals(masterField)) {
					validField = true;
					break;
				}
			}
			if (!validField) {
				throw new IllegalArgumentException(String.format(exceptionFormat, "Field in master definition not found", fieldName,
						classType, className, Arrays.toString(visited.toArray())));
			}

			// pull the field traits from the data dictionary class and apply to this field
			Map<String,Object> masterTraits = mergeFieldTraits(masterField, masterCube, axisName, scope, traits);

			// check for extended definitions
			//MODIFIED: Change to use local R_EXTENDS
			String extension = (String) masterTraits.get(R_EXTENDS);
			if (!StringUtilities.isEmpty(extension)) {
				defsToProcess.add(extension);
			}
		} // end while
	}

	/**
	 * merges trait entries from the current cube into the list of traits that have already been extracted
	 * COPIED: Copied from Dynamis
	 */
	private Map<String, Object> mergeFieldTraits(String fieldName, NCube ncube, String axisName, Map<String, Object> scope,	Map<String, Object> traits)
	{
		Set<String> invalidTraits = new LinkedHashSet<>();
		Map<String, Object> traitCells = getTraitsForEntry(ncube, fieldName, axisName, scope);
		for (Map.Entry<String, Object> cell : traitCells.entrySet())
		{
			String traitName = cell.getKey();
			Object traitValue = cell.getValue();

			if (!traits.containsKey(traitName))
			{
				traits.put(traitName, traitValue);
			}
		}

		for(String msg : invalidTraits)
		{
			//MODIFIED: Not logging
			//LOG.warn(msg);
		}
		return traitCells;
	}

	/**
	 * Returns the nCube for the specified class (or enum)
	 * COPIED: Copied from Dynamis
	 */
	private NCube findClassCube(String cubeType, String className) {
		// MODIFIED: Removed scope arugment. Not performing scope check here.
		if (className==null || !PATTERN_CLASS_NAME.matcher(className).matches())
		{
			throw new IllegalArgumentException("Invalid class identifier [" + className + "] was specified for " + cubeType);
		}

		NCube ncube = NCubeManager.getCube(applicationID, cubeType + "." + className);
		if (ncube==null)
		{
			return null;
		}

		// MODIFIED: Not performing scope check here.
		/*
		Set<String> requiredScope = getRequiredScope(ncube);
		if (RPM_ENUM.equals(cubeType))
		{
			requiredScope.remove("name");
		}
		ensureEnoughScopeProvided(className, scope, requiredScope);
		*/
		return ncube;
	}

	/**
	 * parses the value of the r:extends trait and adds all mixins to the list of classes to process
	 * COPIED: Copied from Dynamis
	 */
	private static void processClassMixins(String className, String mixins, LinkedList<String> classesToProcess) {
		Matcher matcher = PATTERN_CLASS_EXTENDS_TRAIT.matcher(mixins);
		if (StringUtilities.isEmpty(mixins) || !matcher.find())
		{
			throw new IllegalArgumentException("Invalid mixin format specified for class='" + className + "': mixin='" + mixins + "'");
		}

		/*MODIFIED: Groovy does not support do-while. Replacing original Dynamis code with for loop.
    do {
        String mixinName = matcher.group(0);
        if (!StringUtilities.isEmpty(mixinName)) {
            classesToProcess.push(mixinName.trim());
        }
    } while (matcher.find());
    */

		for (; ;) { // infinite for
			String mixinName = matcher.group(0);
			if (!StringUtilities.isEmpty(mixinName)) {
				classesToProcess.push(mixinName.trim());
			}

			if (!matcher.find()) { //condition to break, oppossite to while
				break
			}
		}

	}


	/**
	 * Get only the traits for the passed in field that have an actual value set on them (containsCell() == true).
	 * This greatly reduces the number of entries in the returned trait map.
	 * COPIED: Copied from Dynamis
	 */
	private static Map<String, Object> getTraitsForEntry(NCube ncube, String fieldName, String key, Map scope)
	{
		// Must copy scope here, because we are using it as our lookup coordinate, and
		// we need to add to it.  Cannot damage original scope.
		Map<String, Object> coord = new CaseInsensitiveMap<String, Object>(scope);
		coord.put(key, fieldName);

		Map<String, Object> traits = new CaseInsensitiveMap<String, Object>();

		for (Column column : ncube.getAxis(TRAIT_AXIS).getColumns())
		{
			coord.put(TRAIT_AXIS, column.getValueThatMatches());
			try
			{
				Object val = ncube.getCell(coord);
				if (!"#NOT_DEFINED".equals(val))
				{
					traits.put((String) column.getValue(), val);
					//MODIFIED: Add cell info to trait map as well.
					Object valNoExecute = ncube.getCellByIdNoExecute(ncube.getCoordinateKey(coord))
					traits.put( (column.getValue() as String) + CELL_INFO_SUFFIX, new CellInfo(valNoExecute));

				}
			}
			catch(CoordinateNotFoundException ignored)
			{
				//no traits defined
			}
		}
		return traits;             // returns 1D (slice) of the ncube
	}


	/**
	 * COPIED: Copied from Dynamis
	 */
	private enum PRIMITIVE_TYPE {
		BOOLEAN(Boolean.class), LONG(Long.class), DOUBLE(Double.class), BIG_DECIMAL(BigDecimal.class), STRING(String.class), DATE(Date.class);

		private Class<?> classType;

		private PRIMITIVE_TYPE(Class<?> classType) {
			this.classType = classType;
		}

		public Class<?> getClassType() {
			return this.classType;
		}

		public PRIMITIVE_TYPE fromName(String typeName) {
			for (PRIMITIVE_TYPE type : values()) {
				if (type.toString().equalsIgnoreCase(typeName) || type.getClassType().getSimpleName().equalsIgnoreCase(typeName)) {
					return type;
				}
			}

			throw new IllegalArgumentException("Unknown primitive type specified: " + typeName);
		}
	}
}